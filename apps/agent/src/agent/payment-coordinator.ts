import { FunctionTool, LlmAgent } from "@google/adk";
import { type Schema, Type } from "@google/genai";
import type { PreparePaymentResponse } from "@payproof/domain";

export const PAYMENT_COORDINATOR_AGENT_NAME = "payment_coordinator";

const preparePaymentParameters: Schema = {
	type: Type.OBJECT,
	required: ["transcript", "userWallet"],
	properties: {
		transcript: {
			type: Type.STRING,
			description: "Orden de pago transcrita desde voz.",
		},
		userWallet: {
			type: Type.STRING,
			description: "Wallet EVM del usuario que debe confirmar el pago.",
		},
		network: {
			type: Type.STRING,
			enum: ["celo-sepolia", "celo"],
		},
		allowedTokens: {
			type: Type.ARRAY,
			items: {
				type: Type.STRING,
				enum: ["USDC", "USDm"],
			},
		},
		merchantAllowlist: {
			type: Type.OBJECT,
			description: "Mapa alias -> address EVM permitido para destinatarios.",
		},
		maxAmount: {
			type: Type.STRING,
		},
		validMinutes: {
			type: Type.INTEGER,
		},
		idempotencyKey: {
			type: Type.STRING,
		},
		invoiceHash: {
			type: Type.STRING,
		},
	},
};

export function createPaymentCoordinatorAgent(params: {
	preparePayment: (input: unknown) => Promise<PreparePaymentResponse>;
}) {
	const preparePaymentTool = new FunctionTool({
		name: "prepare_payment",
		description: "Prepara una propuesta de pago; nunca firma ni mueve fondos.",
		parameters: preparePaymentParameters,
		execute: async (input) => params.preparePayment(input),
	});

	return new LlmAgent({
		name: PAYMENT_COORDINATOR_AGENT_NAME,
		model: "gemini-2.5-flash",
		instruction: [
			"Nunca inventes direcciones.",
			"Nunca cambies montos o tokens despues de crear el mandato.",
			"Usa prepare_payment antes de cualquier pago.",
			"Una decision del modelo no equivale a autorizacion financiera.",
		].join("\n"),
		tools: [preparePaymentTool],
	});
}
