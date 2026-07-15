import { AssemblyAI } from "assemblyai";

export class AssemblyAiService {
	private readonly client?: AssemblyAI;

	constructor(apiKey?: string) {
		if (apiKey) {
			this.client = new AssemblyAI({ apiKey });
		}
	}

	async createStreamingToken(expiresInSeconds: number): Promise<{
		token: string;
		expiresInSeconds: number;
		speechModel: "universal-3-5-pro";
	}> {
		if (!this.client) {
			throw new Error("ASSEMBLYAI_API_KEY is not configured.");
		}

		const token = await this.client.streaming.createTemporaryToken({
			expires_in_seconds: expiresInSeconds,
		});

		return {
			token,
			expiresInSeconds,
			speechModel: "universal-3-5-pro",
		};
	}

	async transcribeUrl(
		audioUrl: string,
	): Promise<{ text: string; confidence?: number }> {
		if (!this.client) {
			throw new Error("ASSEMBLYAI_API_KEY is not configured.");
		}

		const transcript = await this.client.transcripts.transcribe({
			audio: audioUrl,
			speech_models: ["universal-3-5-pro"],
			prompt:
				"Orden de pago por voz para proveedores, facturas, tokens USDC o USDm y montos.",
		});

		if (transcript.status === "error") {
			throw new Error(transcript.error ?? "AssemblyAI transcription failed.");
		}

		return {
			text: transcript.text ?? "",
			confidence: transcript.confidence ?? undefined,
		};
	}
}
