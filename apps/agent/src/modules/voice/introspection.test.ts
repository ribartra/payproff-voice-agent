import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { VoiceIntrospectionService } from "./introspection.js";

const fixtures: string[] = [];

afterEach(async () => {
	await Promise.all(
		fixtures.map((fixture) => rm(fixture, { recursive: true })),
	);
	fixtures.length = 0;
});

describe("VoiceIntrospectionService", () => {
	test("loads a pre-recorded introspection and attaches preliminary intent", async () => {
		const fixture = path.join(tmpdir(), `payproof-introspection-${Date.now()}`);
		fixtures.push(fixture);
		await mkdir(fixture, { recursive: true });
		await writeFile(path.join(fixture, "processing.mp3"), "audio-bytes");
		await writeFile(
			path.join(fixture, "manifest.json"),
			JSON.stringify({
				generationInfo: {
					model: "pre-recorded-google-tts",
					voice: "es-ES-Neural2-A",
					languageCode: "es-ES",
					generatedAt: "2026-07-18T00:00:00.000Z",
				},
				files: [
					{
						id: "processing_01",
						text: "Estoy validando el pago.",
						filename: "processing.mp3",
						mimeType: "audio/mpeg",
						status: "success",
					},
				],
			}),
		);

		const service = new VoiceIntrospectionService(fixture);
		const response = await service.getProcessingIntrospection(
			"Paga 0.5 USDC al proveedor",
		);

		expect(response.kind).toBe("payment_processing");
		expect(response.id).toBe("processing_01");
		expect(response.audioBase64).toBe(
			Buffer.from("audio-bytes").toString("base64"),
		);
		expect(response.intent.intent).toBe("payment");
		expect(response.intent.entities.amount).toBe("0.5");
	});
});
