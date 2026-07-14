import { z } from "zod";

export const paymentIntentSchema = z.object({
	amount: z.string().min(1),
	currency: z.enum(["USDC", "USDm", "CELO"]),
	recipient: z.string().min(1),
	reason: z.string().min(1),
});

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

export const paymentStateSchema = z.enum([
	"draft",
	"policy_approved",
	"signature_requested",
	"submitted",
	"confirmed",
	"rejected",
	"failed",
]);

export type PaymentState = z.infer<typeof paymentStateSchema>;

export const policyDecisionSchema = z.object({
	approved: z.boolean(),
	reasons: z.array(z.string()).default([]),
	mandateHash: z.string().optional(),
});

export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
