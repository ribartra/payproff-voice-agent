import { describe, expect, test } from "bun:test";
import { parseGeminiIntentPayload } from "./payment-intent-parser.js";

describe("parseGeminiIntentPayload", () => {
	test("uses the transcript when Gemini returns a null reason", () => {
		const intent = parseGeminiIntentPayload(
			{
				recipientAlias: "proveedor",
				amount: "0.5",
				token: "USDC",
				condition: null,
				reason: null,
				confidence: 0.92,
			},
			"paga 0.5 USDC a proveedor",
		);

		expect(intent).toEqual({
			recipientAlias: "proveedor",
			amount: "0.5",
			token: "USDC",
			reason: "paga 0.5 USDC a proveedor",
			confidence: 0.92,
		});
	});

	test("keeps a valid Gemini reason and removes null condition", () => {
		const intent = parseGeminiIntentPayload(
			{
				recipientAlias: "tesoreria",
				amount: 1,
				token: "USDC",
				condition: null,
				reason: "reembolso operativo",
				confidence: 0.95,
			},
			"paga 1 USDC a tesoreria por reembolso operativo",
		);

		expect(intent.reason).toBe("reembolso operativo");
		expect(intent.amount).toBe("1");
		expect(intent.condition).toBeUndefined();
	});
});
