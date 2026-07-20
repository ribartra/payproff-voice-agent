import { describe, expect, test } from "vitest";
import {
	buildPaymentRequestPayload,
	shouldRefreshSnapshotFromEvent,
} from "./payment-flow";

describe("payment-flow helpers", () => {
	test("builds the backend preparation payload with contact aliases", () => {
		const payload = buildPaymentRequestPayload({
			transcript: "Paga 0.5 USDC al proveedor",
			userWallet: "0x1111111111111111111111111111111111111111",
			merchantAlias: "proveedor",
			merchantAddress: "0x2222222222222222222222222222222222222222",
			maxAmount: "10",
			idempotencyKey: "demo-1",
			contacts: [
				{
					id: "contact-1",
					userId: "user-1",
					alias: "cafeteria",
					walletAddress: "0x3333333333333333333333333333333333333333",
					network: "celo-sepolia",
					preferredToken: "USDC",
				},
			],
		});

		expect("amount" in payload).toBe(false);
		expect(payload.merchantAllowlist).toEqual({
			cafeteria: "0x3333333333333333333333333333333333333333",
			proveedor: "0x2222222222222222222222222222222222222222",
		});
		expect(payload.idempotencyKey).toBe("demo-1");
	});

	test("maps realtime events to snapshot refresh categories", () => {
		expect(
			shouldRefreshSnapshotFromEvent({
				eventId: "event-1",
				type: "contact.updated",
				version: 1,
				occurredAt: "2026-07-19T00:00:00.000Z",
				userId: "user-1",
				aggregateId: "contact-1",
				payload: {},
			}),
		).toBe("contacts");
		expect(
			shouldRefreshSnapshotFromEvent({
				eventId: "event-2",
				type: "payment.confirmed",
				version: 1,
				occurredAt: "2026-07-19T00:00:00.000Z",
				userId: "user-1",
				aggregateId: "payment-1",
				payload: {},
			}),
		).toBe("payments");
	});
});
