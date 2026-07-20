import { describe, expect, test } from "bun:test";
import type { RealtimeEnvelope } from "@payproof/domain";
import { type OutboxEvent, OutboxWorker } from "./outbox-worker.js";

const event: OutboxEvent = {
	outboxId: "outbox-1",
	attempts: 0,
	eventId: "event-1",
	type: "payment.submitted",
	version: 1,
	occurredAt: "2026-07-19T00:00:00.000Z",
	userId: "user-1",
	aggregateId: "payment-1",
	payload: { paymentId: "payment-1" },
};

describe("OutboxWorker", () => {
	test("publishes pending events and marks them published", async () => {
		const published: RealtimeEnvelope[] = [];
		const marked: string[] = [];
		const worker = new OutboxWorker(
			{
				async listPending() {
					return [event];
				},
				async markPublished(outboxId) {
					marked.push(outboxId);
				},
				async markFailed() {
					throw new Error("Unexpected failure path.");
				},
			},
			{
				async publish(nextEvent) {
					published.push(nextEvent);
				},
			},
			{ batchSize: 10, retryDelayMs: 1000 },
		);

		const result = await worker.drainOnce();

		expect(result).toEqual({ published: 1, failed: 0 });
		expect(published[0]?.eventId).toBe("event-1");
		expect(marked).toEqual(["outbox-1"]);
	});

	test("retries failed publishes without throwing the whole batch", async () => {
		const failed: string[] = [];
		const worker = new OutboxWorker(
			{
				async listPending() {
					return [event];
				},
				async markPublished() {
					throw new Error("Unexpected publish success.");
				},
				async markFailed(outboxId) {
					failed.push(outboxId);
				},
			},
			{
				async publish() {
					throw new Error("Redis unavailable.");
				},
			},
			{ batchSize: 10, retryDelayMs: 1000 },
		);

		const result = await worker.drainOnce();

		expect(result).toEqual({ published: 0, failed: 1 });
		expect(failed).toEqual(["outbox-1"]);
	});
});
