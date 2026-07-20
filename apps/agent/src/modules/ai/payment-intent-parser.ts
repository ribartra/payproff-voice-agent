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
	amount: z.union([z.string().min(1), z.number()]).transform(String),
	token: tokenSymbolSchema,
	condition: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
	reason: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value?.trim() || undefined),
	confidence: z.number().min(0).max(1),
});

export function parseGeminiIntentPayload(
	payload: unknown,
	transcript: string,
): ParsedPaymentIntent {
	const parsed = geminiIntentSchema.parse(payload);
	return parsedPaymentIntentSchema.parse({
		...parsed,
		reason: parsed.reason ?? transcript.trim(),
	});
}

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
					"recipientAlias, amount, token, reason y confidence son obligatorios y nunca deben ser null.",
					"reason debe ser una frase breve basada en la orden original; si no hay otra razón, usa la orden completa.",
					"condition puede ser null sólo si no hay una condición explícita.",
					"No inventes direcciones. Si el monto, token o destinatario es ambiguo, baja confidence.",
					`Orden: ${transcript}`,
				].join("\n"),
				config: {
					responseMimeType: "application/json",
					temperature: 0,
				},
			});

			return parseGeminiIntentPayload(
				JSON.parse(response.text ?? "{}"),
				transcript,
			);
		} catch (error) {
			console.warn(
				`Payment intent parser fell back to heuristics: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
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
