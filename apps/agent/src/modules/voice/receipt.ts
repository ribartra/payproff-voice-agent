import { GoogleGenAI } from "@google/genai";
import type { PreparePaymentResponse } from "@payproof/domain";

export class VoiceReceiptService {
	private readonly client?: GoogleGenAI;

	constructor(
		apiKey: string | undefined,
		private readonly model: string,
	) {
		if (apiKey) {
			this.client = new GoogleGenAI({ apiKey });
		}
	}

	async generateReceipt(payment: PreparePaymentResponse): Promise<{
		text: string;
		model: string;
		audioBase64?: string;
	}> {
		const fallback = buildReceiptText(payment);

		if (!this.client) {
			return {
				text: fallback,
				model: "local-template",
			};
		}

		const response = await this.client.models.generateContent({
			model: this.model,
			contents: [
				"Redacta una respuesta de voz breve en español para confirmar el estado de una propuesta de pago.",
				"No digas que se movieron fondos si el estado no es confirmed.",
				`Datos: ${JSON.stringify(payment)}`,
			].join("\n"),
			config: {
				temperature: 0.2,
			},
		});

		return {
			text: response.text?.trim() || fallback,
			model: this.model,
		};
	}
}

function buildReceiptText(payment: PreparePaymentResponse): string {
	if (payment.state === "awaiting_confirmation") {
		return payment.confirmationPrompt;
	}
	if (payment.policy.status === "REJECTED") {
		return `Pago rechazado. ${payment.policy.reasons.join(" ")}`;
	}
	return `Necesito revisión humana. ${payment.policy.reasons.join(" ")}`;
}
