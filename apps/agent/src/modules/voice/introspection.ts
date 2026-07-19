import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
	type PaymentCommandResult,
	PaymentCommandRouter,
} from "./payment-command-router.js";

const DEFAULT_INTROSPECTIONS_DIR = "assets/introspections";
const INTROSPECTION_KIND = "payment_processing";

const introspectionManifestSchema = z.object({
	generationInfo: z.object({
		model: z.string().min(1),
		voice: z.string().min(1),
		languageCode: z.string().min(1),
		generatedAt: z.string().min(1),
	}),
	files: z
		.array(
			z.object({
				id: z.string().min(1),
				text: z.string().min(1),
				filename: z.string().min(1),
				mimeType: z.literal("audio/mpeg"),
				status: z.literal("success"),
			}),
		)
		.min(1),
});

type IntrospectionManifest = z.infer<typeof introspectionManifestSchema>;

export type VoiceIntrospectionResponse = {
	kind: typeof INTROSPECTION_KIND;
	id: string;
	text: string;
	model: string;
	mimeType: "audio/mpeg";
	audioBase64: string;
	source: "pre-recorded";
	selectedAt: string;
	intent: PaymentCommandResult;
};

export class VoiceIntrospectionService {
	private readonly router = new PaymentCommandRouter();
	private manifest?: IntrospectionManifest;

	constructor(private readonly baseDir = DEFAULT_INTROSPECTIONS_DIR) {}

	async getProcessingIntrospection(
		transcript: string,
	): Promise<VoiceIntrospectionResponse> {
		const intent = this.router.route(transcript);
		const manifest = await this.loadManifest();
		const selected = selectIntrospection(manifest.files, transcript);
		const audioPath = path.join(
			resolveAssetsDir(this.baseDir),
			selected.filename,
		);
		const audio = await readFile(audioPath);

		return {
			kind: INTROSPECTION_KIND,
			id: selected.id,
			text: selected.text,
			model: manifest.generationInfo.model,
			mimeType: selected.mimeType,
			audioBase64: audio.toString("base64"),
			source: "pre-recorded",
			selectedAt: new Date().toISOString(),
			intent,
		};
	}

	private async loadManifest(): Promise<IntrospectionManifest> {
		if (this.manifest) {
			return this.manifest;
		}

		const manifestPath = path.join(
			resolveAssetsDir(this.baseDir),
			"manifest.json",
		);
		const raw = await readFile(manifestPath, "utf8");
		this.manifest = introspectionManifestSchema.parse(JSON.parse(raw));
		return this.manifest;
	}
}

function selectIntrospection(
	files: IntrospectionManifest["files"],
	transcript: string,
) {
	const source = transcript.trim() || String(Date.now());
	const index =
		Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
		files.length;
	return files[index];
}

function resolveAssetsDir(baseDir: string): string {
	if (path.isAbsolute(baseDir)) {
		return baseDir;
	}

	return path.resolve(process.cwd(), baseDir);
}
