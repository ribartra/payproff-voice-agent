import { describe, expect, test } from "bun:test";
import type {
	PreparedPaymentRecord,
	PreparePaymentRequest,
	PreparePaymentResponse,
} from "@payproof/domain";
import {
	createRequestHash,
	IdempotencyConflictError,
} from "../../repositories/payments.js";
import { PaymentPreparationService } from "./preparation-service.js";

const request: PreparePaymentRequest = {
	transcript: "Paga 0.5 USDC al proveedor",
	userWallet: "0x1111111111111111111111111111111111111111",
	network: "celo-sepolia",
	allowedTokens: ["USDC"],
	merchantAllowlist: {
		proveedor: "0x2222222222222222222222222222222222222222",
	},
	maxAmount: "10",
	validMinutes: 15,
	idempotencyKey: "demo-1",
};

describe("PaymentPreparationService", () => {
	test("returns the existing payment on idempotent retry", async () => {
		const existing = createRecord(createRequestHash(request));
		const service = new PaymentPreparationService(
			{
				async findByIdempotency() {
					return existing;
				},
				async insertPreparation() {
					throw new Error("Should not insert on retry.");
				},
			},
			{
				async prepare() {
					throw new Error("Should not call agent on retry.");
				},
			},
			{ userId: "user-1", tokenDecimals: 6 },
		);

		const result = await service.prepare(request);

		expect(result).toBe(existing);
	});

	test("rejects idempotency key reuse with a different payload", async () => {
		const service = new PaymentPreparationService(
			{
				async findByIdempotency() {
					return createRecord(createRequestHash(request));
				},
				async insertPreparation() {
					throw new Error("Should not insert conflicting payload.");
				},
			},
			{
				async prepare() {
					throw new Error("Should not call agent for conflict.");
				},
			},
			{ userId: "user-1", tokenDecimals: 6 },
		);

		await expect(
			service.prepare({ ...request, transcript: "Paga 0.6 USDC al proveedor" }),
		).rejects.toBeInstanceOf(IdempotencyConflictError);
	});

	test("calls the agent and persists a new preparation", async () => {
		let agentCalled = false;
		const service = new PaymentPreparationService(
			{
				async findByIdempotency() {
					return null;
				},
				async insertPreparation(params) {
					return createRecord(params.requestHash);
				},
			},
			{
				async prepare() {
					agentCalled = true;
					return createResponse();
				},
			},
			{ userId: "user-1", tokenDecimals: 6 },
		);

		const result = await service.prepare(request);

		expect(agentCalled).toBe(true);
		expect(result.requestHash).toMatch(/^0x[0-9a-f]{64}$/);
	});
});

function createRecord(requestHash: `0x${string}`): PreparedPaymentRecord {
	return {
		id: "record-1",
		paymentId: "payment-1",
		userId: "user-1",
		userWallet: request.userWallet,
		network: "celo-sepolia",
		chainId: 11142220,
		tokenSymbol: "USDC",
		tokenAddress: "0x3333333333333333333333333333333333333333",
		tokenDecimals: 6,
		recipientAddress: "0x2222222222222222222222222222222222222222",
		amountBaseUnits: "500000",
		amountDisplay: "0.5",
		idempotencyKey: "demo-1",
		requestHash,
		mandateHash:
			"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		policyDecision: {
			status: "APPROVED",
			approved: true,
			reasons: [],
			mandateHash:
				"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		},
		state: "awaiting_confirmation",
		response: createResponse(),
		expiresAt: "2026-07-19T00:15:00.000Z",
		createdAt: "2026-07-19T00:00:00.000Z",
		updatedAt: "2026-07-19T00:00:00.000Z",
	};
}

function createResponse(): PreparePaymentResponse {
	return {
		paymentId: "payment-1",
		state: "awaiting_confirmation",
		intent: {
			recipientAlias: "proveedor",
			recipientAddress: "0x2222222222222222222222222222222222222222",
			amount: "0.5",
			token: "USDC",
			reason: "demo",
			confidence: 0.9,
		},
		policy: {
			status: "APPROVED",
			approved: true,
			reasons: [],
			mandateHash:
				"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		},
		paymentMandate: {
			id: "mandate-1",
			checkoutMandateId: "checkout-1",
			payer: request.userWallet,
			payee: "0x2222222222222222222222222222222222222222",
			tokenAddress: "0x3333333333333333333333333333333333333333",
			amountBaseUnits: "500000",
			chainId: 11142220,
			authorizationType: "WALLET_TRANSACTION",
		},
		confirmationPrompt: "Confirma el pago de 0.5 USDC.",
	};
}
