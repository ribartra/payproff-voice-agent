import { z } from "zod";

export const tokenSymbolSchema = z.enum(["USDC", "USDm"]);
export type TokenSymbol = z.infer<typeof tokenSymbolSchema>;

export const networkSchema = z.enum(["celo-sepolia", "celo"]);
export type Network = z.infer<typeof networkSchema>;

export const addressSchema = z.custom<`0x${string}`>(
	(value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value),
	"Expected an EVM address",
);

export const paymentIntentSchema = z.object({
	amount: z.string().min(1),
	currency: z.enum(["USDC", "USDm", "CELO"]),
	recipient: z.string().min(1),
	reason: z.string().min(1),
});

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

export const parsedPaymentIntentSchema = z.object({
	recipientAlias: z.string().min(1),
	recipientAddress: addressSchema.optional(),
	amount: z.string().min(1),
	token: tokenSymbolSchema,
	condition: z.string().optional(),
	reason: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

export type ParsedPaymentIntent = z.infer<typeof parsedPaymentIntentSchema>;

export const paymentStateSchema = z.enum([
	"draft",
	"prepared",
	"transcribed",
	"intent_parsed",
	"policy_checked",
	"payment_prepared",
	"awaiting_confirmation",
	"submitting",
	"authorized",
	"awaiting_wallet_signature",
	"policy_approved",
	"signature_requested",
	"submitted",
	"confirmed",
	"ambiguous",
	"rejected",
	"requires_review",
	"signature_rejected",
	"wrong_network",
	"insufficient_funds",
	"expired",
	"reverted",
	"duplicate",
	"failed",
	"reorged",
]);

export type PaymentState = z.infer<typeof paymentStateSchema>;

export const policyDecisionSchema = z.object({
	status: z.enum(["APPROVED", "REQUIRES_REVIEW", "REJECTED"]),
	approved: z.boolean(),
	reasons: z.array(z.string()).default([]),
	mandateHash: z.string().optional(),
});

export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

export const intentMandateSchema = z.object({
	id: z.string().min(1),
	userWallet: addressSchema,
	instruction: z.string().min(1),
	allowedTokens: z.array(tokenSymbolSchema).min(1),
	merchantAllowlist: z.array(addressSchema),
	maxAmount: z.string().min(1),
	validUntil: z.string().datetime(),
	createdAt: z.string().datetime(),
});

export type IntentMandate = z.infer<typeof intentMandateSchema>;

export const checkoutMandateSchema = z.object({
	id: z.string().min(1),
	intentMandateId: z.string().min(1),
	merchant: addressSchema,
	description: z.string().min(1),
	amount: z.string().min(1),
	token: tokenSymbolSchema,
	network: networkSchema,
	expiresAt: z.string().datetime(),
	evidenceHash: z.string().optional(),
});

export type CheckoutMandate = z.infer<typeof checkoutMandateSchema>;

export const paymentMandateSchema = z.object({
	id: z.string().min(1),
	checkoutMandateId: z.string().min(1),
	payer: addressSchema,
	payee: addressSchema,
	tokenAddress: addressSchema,
	amountBaseUnits: z.string().min(1),
	chainId: z.number().int().positive(),
	authorizationType: z.enum(["WALLET_TRANSACTION", "EIP3009", "X402"]),
	signedAt: z.string().datetime().optional(),
	signature: z
		.custom<`0x${string}`>(
			(value) => typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value),
			"Expected a hex signature",
		)
		.optional(),
});

export type PaymentMandate = z.infer<typeof paymentMandateSchema>;

export const preparePaymentRequestSchema = z.object({
	transcript: z.string().min(1),
	userWallet: addressSchema,
	network: networkSchema.default("celo-sepolia"),
	allowedTokens: z.array(tokenSymbolSchema).default(["USDC", "USDm"]),
	merchantAllowlist: z.record(z.string().min(1), addressSchema).default({}),
	maxAmount: z.string().default("10"),
	validMinutes: z.number().int().positive().max(1440).default(15),
	idempotencyKey: z.string().min(1).optional(),
	invoiceHash: z.string().min(1).optional(),
});

export type PreparePaymentRequest = z.infer<typeof preparePaymentRequestSchema>;

export const preparePaymentResponseSchema = z.object({
	paymentId: z.string().min(1),
	state: paymentStateSchema,
	intent: parsedPaymentIntentSchema,
	policy: policyDecisionSchema,
	intentMandate: intentMandateSchema.optional(),
	checkoutMandate: checkoutMandateSchema.optional(),
	paymentMandate: paymentMandateSchema.optional(),
	confirmationPrompt: z.string().min(1),
});

export type PreparePaymentResponse = z.infer<
	typeof preparePaymentResponseSchema
>;

export const hexSchema = z.custom<`0x${string}`>(
	(value) => typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value),
	"Expected a hex string",
);

export const paymentTransactionStatusSchema = z.enum([
	"submitting",
	"submitted",
	"confirmed",
	"failed",
	"reorged",
]);

export type PaymentTransactionStatus = z.infer<
	typeof paymentTransactionStatusSchema
>;

export const paymentSubmissionRequestSchema = z.object({
	txHash: hexSchema,
	chainId: z.number().int().positive(),
	contractAddress: addressSchema,
	fromAddress: addressSchema,
	toAddress: addressSchema,
});

export type PaymentSubmissionRequest = z.infer<
	typeof paymentSubmissionRequestSchema
>;

export const paymentExecutionRequestSchema = z.object({
	paymentId: z.string().min(1),
	contractAddress: addressSchema,
});

export type PaymentExecutionRequest = z.infer<
	typeof paymentExecutionRequestSchema
>;

export const preparedPaymentRecordSchema = z.object({
	id: z.string().min(1),
	paymentId: z.string().min(1),
	userId: z.string().min(1),
	userWallet: addressSchema,
	network: networkSchema,
	chainId: z.number().int().positive(),
	tokenSymbol: tokenSymbolSchema,
	tokenAddress: addressSchema,
	tokenDecimals: z.number().int().positive(),
	recipientAddress: addressSchema,
	amountBaseUnits: z.string().min(1),
	amountDisplay: z.string().min(1),
	idempotencyKey: z.string().min(1).optional(),
	requestHash: hexSchema,
	mandateHash: hexSchema.optional(),
	contractAddress: addressSchema.optional(),
	policyDecision: policyDecisionSchema,
	state: paymentStateSchema,
	response: preparePaymentResponseSchema,
	expiresAt: z.string().datetime(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export type PreparedPaymentRecord = z.infer<typeof preparedPaymentRecordSchema>;

export const paymentTransactionRecordSchema = z.object({
	id: z.string().min(1),
	paymentId: z.string().min(1),
	txHash: hexSchema,
	chainId: z.number().int().positive(),
	contractAddress: addressSchema,
	fromAddress: addressSchema,
	toAddress: addressSchema,
	status: paymentTransactionStatusSchema,
	blockNumber: z.string().optional(),
	blockHash: hexSchema.optional(),
	confirmations: z.number().int().nonnegative().optional(),
	errorCode: z.string().optional(),
	errorMessage: z.string().optional(),
	submittedAt: z.string().datetime(),
	confirmedAt: z.string().datetime().optional(),
});

export type PaymentTransactionRecord = z.infer<
	typeof paymentTransactionRecordSchema
>;

export const chainEventRecordSchema = z.object({
	id: z.string().min(1),
	chainId: z.number().int().positive(),
	contractAddress: addressSchema,
	txHash: hexSchema,
	logIndex: z.number().int().nonnegative(),
	blockNumber: z.string().min(1),
	blockHash: hexSchema,
	eventName: z.literal("PaymentExecuted"),
	paymentId: hexSchema,
	mandateHash: hexSchema,
	payer: addressSchema,
	tokenAddress: addressSchema,
	recipientAddress: addressSchema,
	amountBaseUnits: z.string().min(1),
	removed: z.boolean(),
	observedAt: z.string().datetime(),
	confirmedAt: z.string().datetime().optional(),
});

export type ChainEventRecord = z.infer<typeof chainEventRecordSchema>;

export const realtimeEventTypeSchema = z.enum([
	"payment.prepared",
	"payment.requires_review",
	"payment.submitted",
	"payment.confirmed",
	"payment.failed",
	"payment.expired",
	"payment.reorged",
	"user.updated",
	"contact.created",
	"contact.updated",
	"contact.deleted",
	"contacts.snapshot_invalidated",
	"session.expired",
]);

export type RealtimeEventType = z.infer<typeof realtimeEventTypeSchema>;

export const realtimeEnvelopeSchema = z.object({
	eventId: z.string().min(1),
	type: realtimeEventTypeSchema,
	version: z.literal(1),
	occurredAt: z.string().datetime(),
	userId: z.string().min(1),
	aggregateId: z.string().min(1),
	payload: z.unknown(),
});

export type RealtimeEnvelope<T = unknown> = Omit<
	z.infer<typeof realtimeEnvelopeSchema>,
	"payload"
> & {
	payload: T;
};

export const contactRealtimePayloadSchema = z.object({
	contact: z.object({
		id: z.string().min(1),
		alias: z.string().min(1),
		walletAddress: addressSchema,
		network: networkSchema,
		preferredToken: tokenSymbolSchema,
		updatedAt: z.string().datetime().optional(),
	}),
	keytermsPrompt: z.array(z.string()),
});

export type ContactRealtimePayload = z.infer<
	typeof contactRealtimePayloadSchema
>;

export const userRealtimePayloadSchema = z.object({
	userId: z.string().min(1),
	walletAddress: addressSchema.optional(),
	updatedAt: z.string().datetime().optional(),
});

export type UserRealtimePayload = z.infer<typeof userRealtimePayloadSchema>;

export const walletChallengeRequestSchema = z.object({
	walletAddress: addressSchema,
	chainId: z.number().int().positive(),
	network: networkSchema.default("celo-sepolia"),
});

export type WalletChallengeRequest = z.infer<
	typeof walletChallengeRequestSchema
>;

export const walletLinkRequestSchema = walletChallengeRequestSchema.extend({
	message: z.string().min(1),
	signature: hexSchema,
});

export type WalletLinkRequest = z.infer<typeof walletLinkRequestSchema>;

export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}
