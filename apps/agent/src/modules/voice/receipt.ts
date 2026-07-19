import { existsSync } from "node:fs";
import path from "node:path";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import type { PreparePaymentResponse } from "@payproof/domain";

const GOOGLE_TTS_MODEL = "google-cloud-tts";
const GOOGLE_TTS_LANGUAGE_CODE = "es-ES";
const GOOGLE_TTS_VOICE = "es-ES-Neural2-A";

export class VoiceReceiptService {
	private readonly client?: TextToSpeechClient;

	constructor(credentialsPath?: string) {
		if (credentialsPath) {
			this.client = new TextToSpeechClient({
				keyFilename: resolveCredentialsPath(credentialsPath),
			});
		}
	}

	async generateReceipt(payment: PreparePaymentResponse): Promise<{
		text: string;
		model: string;
		mimeType?: "audio/mpeg";
		voice?: string;
		audioBase64?: string;
	}> {
		const text = buildReceiptText(payment);

		if (!this.client) {
			return {
				text,
				model: "local-template",
			};
		}

		const [response] = await this.client.synthesizeSpeech({
			input: { text },
			voice: {
				languageCode: GOOGLE_TTS_LANGUAGE_CODE,
				name: GOOGLE_TTS_VOICE,
			},
			audioConfig: {
				audioEncoding: "MP3",
				sampleRateHertz: 24000,
				speakingRate: 1,
				pitch: 0,
			},
		});

		if (!response.audioContent) {
			throw new Error("Google Cloud TTS returned empty audio.");
		}

		return {
			text,
			model: GOOGLE_TTS_MODEL,
			audioBase64: Buffer.from(response.audioContent).toString("base64"),
			mimeType: "audio/mpeg",
			voice: GOOGLE_TTS_VOICE,
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

function resolveCredentialsPath(credentialsPath: string): string {
	if (path.isAbsolute(credentialsPath) || existsSync(credentialsPath)) {
		return credentialsPath;
	}

	const fromRepoRoot = path.resolve(process.cwd(), "../..", credentialsPath);
	if (existsSync(fromRepoRoot)) {
		return fromRepoRoot;
	}

	return credentialsPath;
}
