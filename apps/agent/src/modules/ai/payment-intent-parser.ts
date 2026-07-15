import { GoogleGenAI } from "@google/genai";
import {
	type ParsedPaymentIntent,
	parsedPaymentIntentSchema,
	tokenSymbolSchema,
} from "@payproof/domain";
import { z } from "zod";

type ParserOptions = {
	apiKey?: string;
	model: string;
};

const geminiIntentSchema = z.object({
	recipientAlias: z.string().min(1),
	amount: z.string().min(1),
	token: tokenSymbolSchema,
	condition: z.string().optional(),
	reason: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

export class PaymentIntentParser {
	private readonly client?: GoogleGenAI;

	constructor(private readonly options: ParserOptions) {
		if (options.apiKey) {
			this.client = new GoogleGenAI({ apiKey: options.apiKey });
		}
	}

	async parse(transcript: string): Promise<ParsedPaymentIntent> {
		if (!this.client) {
			return parseWithHeuristics(transcript);
		}

		try {
			const response = await this.client.models.generateContent({
				model: this.options.model,
				contents: [
					"Extrae una intención de pago desde la orden de voz. Responde sólo JSON válido.",
					"Campos: recipientAlias, amount, token, condition, reason, confidence.",
					"No inventes direcciones. Si el monto, token o destinatario es ambiguo, baja confidence.",
					`Orden: ${transcript}`,
				].join("\n"),
				config: {
					responseMimeType: "application/json",
					temperature: 0,
				},
			});

			const parsed = geminiIntentSchema.parse(
				JSON.parse(response.text ?? "{}"),
			);
			return parsedPaymentIntentSchema.parse(parsed);
		} catch {
			return parseWithHeuristics(transcript);
		}
	}
}

function parseWithHeuristics(transcript: string): ParsedPaymentIntent {
	const normalized = transcript.trim();
	const lower = normalized.toLowerCase();
	const amount =
		lower.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(",", ".") ?? "0";
	const token =
		lower.includes("usdm") || lower.includes("cusd") ? "USDm" : "USDC";
	const recipientAlias =
		lower.match(/\b(?:al|a|para|merchant)\s+([a-z0-9_.-]+)/i)?.[1] ??
		lower.match(/0x[a-f0-9]{40}/i)?.[0] ??
		"unknown";
	const confidence =
		amount !== "0" && recipientAlias !== "unknown" ? 0.92 : 0.5;

	return parsedPaymentIntentSchema.parse({
		recipientAlias,
		amount,
		token,
		reason: normalized,
		condition: lower.includes("factura") ? "invoice_must_be_valid" : undefined,
		confidence,
	});
}
