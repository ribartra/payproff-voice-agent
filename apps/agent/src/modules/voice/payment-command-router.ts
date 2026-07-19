export type PaymentCommandIntent = "payment" | "unknown";

export type PaymentCommandResult = {
	intent: PaymentCommandIntent;
	confidence: number;
	rawText: string;
	normalizedText: string;
	isCommand: boolean;
	entities: {
		amount?: string;
		token?: "USDC" | "USDm";
		recipientAlias?: string;
	};
};

const PAYMENT_KEYWORDS = [
	"paga",
	"pagar",
	"pago",
	"transfiere",
	"transferir",
	"envia",
	"enviar",
	"autoriza",
	"autorizar",
	"usdc",
	"usdm",
];

const RECIPIENT_PATTERN =
	/\b(?:al|a|para|destinatario|proveedor|comercio)\s+([a-z0-9_.-]+)/i;

export class PaymentCommandRouter {
	route(text: string): PaymentCommandResult {
		const normalizedText = normalizeText(text);

		if (!normalizedText) {
			return createUnknownResult(text, normalizedText);
		}

		const amount = normalizedText
			.match(/(\d+(?:[.,]\d+)?)/)?.[1]
			?.replace(",", ".");
		const token = normalizedText.includes("usdm") ? "USDm" : "USDC";
		const recipientAlias = normalizedText.match(RECIPIENT_PATTERN)?.[1];
		const keywordScore = calculateKeywordScore(normalizedText);
		const entityScore =
			(amount ? 0.25 : 0) +
			(recipientAlias ? 0.2 : 0) +
			(normalizedText.includes("usdc") || normalizedText.includes("usdm")
				? 0.2
				: 0);
		const confidence = Math.min(keywordScore + entityScore, 0.95);
		const isCommand = confidence >= 0.45;

		if (!isCommand) {
			return createUnknownResult(text, normalizedText);
		}

		return {
			intent: "payment",
			confidence,
			rawText: text,
			normalizedText,
			isCommand,
			entities: {
				amount,
				token,
				recipientAlias,
			},
		};
	}
}

function calculateKeywordScore(normalizedText: string): number {
	const words = new Set(normalizedText.split(" "));
	let score = 0;

	for (const keyword of PAYMENT_KEYWORDS) {
		if (words.has(keyword)) {
			score += keyword === "usdc" || keyword === "usdm" ? 0.25 : 0.35;
		}
	}

	return Math.min(score, 0.5);
}

function createUnknownResult(
	rawText: string,
	normalizedText: string,
): PaymentCommandResult {
	return {
		intent: "unknown",
		confidence: 0,
		rawText,
		normalizedText,
		isCommand: false,
		entities: {},
	};
}

function normalizeText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}
