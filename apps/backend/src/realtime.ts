import { randomUUID } from "node:crypto";
import type { RealtimeEnvelope, RealtimeEventType } from "@payproof/domain";
import { createClient, type RedisClientType } from "redis";
import type { Queryable } from "./db.js";
import type { OutboxEvent } from "./modules/outbox/outbox-worker.js";

const CHANNEL_PREFIX = "payproof:user:";

export type RealtimeEventInput = {
	userId: string;
	aggregateId: string;
	type: RealtimeEventType;
	payload: unknown;
};

export class RealtimeRepository {
	constructor(
		private readonly db: Queryable,
		private readonly eventTtlSeconds: number,
	) {}

	async store(event: RealtimeEnvelope): Promise<RealtimeEnvelope> {
		await this.db.query(
			`
				insert into payproof_realtime_events (
					event_id,
					user_id,
					aggregate_id,
					event_type,
					payload_json,
					expires_at
				)
				values ($1, $2, $3, $4, $5, now() + ($6::int * interval '1 second'))
				on conflict (event_id) do nothing
			`,
			[
				event.eventId,
				event.userId,
				event.aggregateId,
				event.type,
				JSON.stringify(event.payload),
				this.eventTtlSeconds,
			],
		);
		return event;
	}

	async storeOutbox(event: RealtimeEnvelope): Promise<void> {
		await this.db.query(
			`
				insert into payproof_outbox_events (
					id,
					event_id,
					user_id,
					aggregate_id,
					event_type,
					payload_json
				)
				values ($1, $2, $3, $4, $5, $6)
				on conflict (event_id) do nothing
			`,
			[
				randomUUID(),
				event.eventId,
				event.userId,
				event.aggregateId,
				event.type,
				JSON.stringify(event.payload),
			],
		);
	}

	async listPendingOutbox(limit = 100): Promise<OutboxEvent[]> {
		const result = await this.db.query<{
			id: string;
			event_id: string;
			user_id: string;
			aggregate_id: string;
			event_type: RealtimeEventType;
			payload_json: unknown;
			attempts: number;
			created_at: Date | string;
		}>(
			`
				select *
				from payproof_outbox_events
				where status = 'pending' and available_at <= now()
				order by created_at asc
				limit $1
			`,
			[limit],
		);

		return result.rows.map((row) => ({
			outboxId: row.id,
			attempts: row.attempts,
			eventId: row.event_id,
			type: row.event_type,
			version: 1,
			occurredAt: toIso(row.created_at),
			userId: row.user_id,
			aggregateId: row.aggregate_id,
			payload: row.payload_json,
		}));
	}

	async markOutboxPublished(outboxId: string): Promise<void> {
		await this.db.query(
			`
				update payproof_outbox_events
				set status = 'published', published_at = now()
				where id = $1
			`,
			[outboxId],
		);
	}

	async markOutboxFailed(params: {
		outboxId: string;
		nextAvailableAt: Date;
	}): Promise<void> {
		await this.db.query(
			`
				update payproof_outbox_events
				set
					status = 'pending',
					attempts = attempts + 1,
					available_at = $2
				where id = $1
			`,
			[params.outboxId, params.nextAvailableAt],
		);
	}

	async listAfter(params: {
		userId: string;
		lastEventId?: string;
		limit?: number;
	}): Promise<RealtimeEnvelope[]> {
		const lastEvent = params.lastEventId
			? await this.db.query<{ created_at: Date | string }>(
					`
						select created_at
						from payproof_realtime_events
						where user_id = $1 and event_id = $2
						limit 1
					`,
					[params.userId, params.lastEventId],
				)
			: undefined;
		const createdAfter = lastEvent?.rows[0]?.created_at;
		const result = await this.db.query<{
			event_id: string;
			user_id: string;
			aggregate_id: string;
			event_type: RealtimeEventType;
			payload_json: unknown;
			created_at: Date | string;
		}>(
			createdAfter
				? `
					select *
					from payproof_realtime_events
					where user_id = $1 and created_at > $2 and expires_at > now()
					order by created_at asc
					limit $3
				`
				: `
					select *
					from payproof_realtime_events
					where user_id = $1 and expires_at > now()
					order by created_at asc
					limit $2
				`,
			createdAfter
				? [params.userId, createdAfter, params.limit ?? 100]
				: [params.userId, params.limit ?? 100],
		);

		return result.rows.map((row) => ({
			eventId: row.event_id,
			type: row.event_type,
			version: 1,
			occurredAt: toIso(row.created_at),
			userId: row.user_id,
			aggregateId: row.aggregate_id,
			payload: row.payload_json,
		}));
	}
}

export class RedisRealtimePublisher {
	private readonly publisher: RedisClientType;
	private readonly subscriber: RedisClientType;

	constructor(redisUrl: string) {
		this.publisher = createClient({ url: redisUrl });
		this.subscriber = createClient({ url: redisUrl });
	}

	async connect(): Promise<void> {
		if (!this.publisher.isOpen) {
			await this.publisher.connect();
		}
		if (!this.subscriber.isOpen) {
			await this.subscriber.connect();
		}
	}

	async publish(event: RealtimeEnvelope): Promise<void> {
		await this.connect();
		await this.publisher.publish(
			channelForUser(event.userId),
			JSON.stringify(event),
		);
	}

	async subscribe(
		userId: string,
		handler: (event: RealtimeEnvelope) => void,
	): Promise<() => Promise<void>> {
		await this.connect();
		const channel = channelForUser(userId);
		await this.subscriber.subscribe(channel, (message) => {
			handler(JSON.parse(message) as RealtimeEnvelope);
		});
		return async () => {
			await this.subscriber.unsubscribe(channel);
		};
	}
}

export function createRealtimeEnvelope(
	input: RealtimeEventInput,
): RealtimeEnvelope {
	return {
		eventId: randomUUID(),
		type: input.type,
		version: 1,
		occurredAt: new Date().toISOString(),
		userId: input.userId,
		aggregateId: input.aggregateId,
		payload: input.payload,
	};
}

function channelForUser(userId: string): string {
	return `${CHANNEL_PREFIX}${userId}`;
}

function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}
