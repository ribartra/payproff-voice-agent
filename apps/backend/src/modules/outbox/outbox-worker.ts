import type { RealtimeEnvelope } from "@payproof/domain";

export type OutboxEvent = RealtimeEnvelope & {
	outboxId: string;
	attempts: number;
};

export type OutboxRepository = {
	listPending(limit: number): Promise<OutboxEvent[]>;
	markPublished(outboxId: string): Promise<void>;
	markFailed(outboxId: string, nextAvailableAt: Date): Promise<void>;
};

export type OutboxPublisher = {
	publish(event: RealtimeEnvelope): Promise<void>;
};

export class OutboxWorker {
	constructor(
		private readonly repository: OutboxRepository,
		private readonly publisher: OutboxPublisher,
		private readonly config: {
			batchSize: number;
			retryDelayMs: number;
		},
	) {}

	async drainOnce(): Promise<{
		published: number;
		failed: number;
	}> {
		const events = await this.repository.listPending(this.config.batchSize);
		let published = 0;
		let failed = 0;

		for (const event of events) {
			try {
				await this.publisher.publish(event);
				await this.repository.markPublished(event.outboxId);
				published += 1;
			} catch {
				await this.repository.markFailed(
					event.outboxId,
					new Date(Date.now() + this.config.retryDelayMs),
				);
				failed += 1;
			}
		}

		return { published, failed };
	}
}
