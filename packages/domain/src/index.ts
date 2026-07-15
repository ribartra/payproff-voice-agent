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
	"transcribed",
	"intent_parsed",
	"policy_checked",
	"payment_prepared",
	"awaiting_confirmation",
	"authorized",
	"awaiting_wallet_signature",
	"policy_approved",
	"signature_requested",
	"submitted",
	"confirmed",
	"ambiguous",
	"rejected",
	"signature_rejected",
	"wrong_network",
	"insufficient_funds",
	"expired",
	"reverted",
	"duplicate",
	"failed",
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
