import { CELO_CHAINS } from "@payproof/celo";
import {
	preparePaymentRequestSchema,
	preparePaymentResponseSchema,
} from "@payproof/domain";
import Fastify from "fastify";
import { z } from "zod";
import {
	createPaymentCoordinatorAgent,
	PAYMENT_COORDINATOR_AGENT_NAME,
} from "./agent/payment-coordinator.js";
import { env } from "./config.js";
import { PaymentIntentParser } from "./modules/ai/payment-intent-parser.js";
import { PaymentApplication } from "./modules/payments/payment-application.js";
import { AssemblyAiService } from "./modules/voice/assemblyai.js";
import { VoiceIntrospectionService } from "./modules/voice/introspection.js";
import { VoiceReceiptService } from "./modules/voice/receipt.js";

const app = Fastify({
	logger: {
		level: process.env.LOG_LEVEL ?? "info",
	},
});

app.addHook("onRequest", async (_request, reply) => {
	reply.header("Access-Control-Allow-Origin", "*");
	reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	reply.header("Access-Control-Allow-Headers", "Content-Type");
});

app.options("/health", async (_request, reply) => reply.code(204).send());
app.options("/payments/prepare", async (_request, reply) =>
	reply.code(204).send(),
);
app.options("/voice/receipt", async (_request, reply) =>
	reply.code(204).send(),
);
app.options("/voice/introspection", async (_request, reply) =>
	reply.code(204).send(),
);

const paymentApplication = new PaymentApplication(
	new PaymentIntentParser({
		apiKey: env.GEMINI_API_KEY,
		model: env.GEMINI_MODEL,
	}),
);
const assemblyAi = new AssemblyAiService(env.ASSEMBLYAI_API_KEY);
const voiceReceipt = new VoiceReceiptService(
	env.GOOGLE_APPLICATION_CREDENTIALS,
);
const voiceIntrospection = new VoiceIntrospectionService();
const paymentCoordinator = createPaymentCoordinatorAgent({
	preparePayment: (input) => paymentApplication.prepare(input),
});

app.get("/health", async () => ({
	ok: true,
	service: "payproof-agent",
	ai: {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		assemblyAiConfigured: Boolean(env.ASSEMBLYAI_API_KEY),
		googleTtsConfigured: Boolean(env.GOOGLE_APPLICATION_CREDENTIALS),
		adkAgent: PAYMENT_COORDINATOR_AGENT_NAME,
		adkTools: paymentCoordinator.tools.length,
	},
	chains: {
		celo: CELO_CHAINS.mainnet.id,
		celoSepolia: CELO_CHAINS.testnet.id,
	},
}));

app.post("/payments/prepare", async (request, reply) => {
	const input = preparePaymentRequestSchema.parse(request.body);
	const payment = await paymentApplication.prepare(input);
	return reply
		.code(payment.policy.status === "REJECTED" ? 422 : 200)
		.send(preparePaymentResponseSchema.parse(payment));
});

app.post("/voice/streaming-token", async (_request, reply) => {
	try {
		return await assemblyAi.createStreamingToken(
			env.ASSEMBLYAI_TOKEN_TTL_SECONDS,
		);
	} catch (error) {
		return reply.code(503).send({
			error:
				error instanceof Error
					? error.message
					: "AssemblyAI token creation failed.",
		});
	}
});

app.post("/voice/transcribe-url", async (request, reply) => {
	const body = z
		.object({
			audioUrl: z.string().url(),
			keytermsPrompt: z.array(z.string().min(1).max(50)).max(100).default([]),
		})
		.parse(request.body);
	try {
		return await assemblyAi.transcribeUrl(body.audioUrl, body.keytermsPrompt);
	} catch (error) {
		return reply.code(503).send({
			error:
				error instanceof Error
					? error.message
					: "AssemblyAI transcription failed.",
		});
	}
});

app.post("/voice/introspection", async (request, reply) => {
	const body = z.object({ transcript: z.string().min(1) }).parse(request.body);
	try {
		return await voiceIntrospection.getProcessingIntrospection(body.transcript);
	} catch (error) {
		return reply.code(503).send({
			error:
				error instanceof Error
					? error.message
					: "Voice introspection is unavailable.",
		});
	}
});

app.post("/voice/receipt", async (request, reply) => {
	const payment = preparePaymentResponseSchema.parse(request.body);
	try {
		return await voiceReceipt.generateReceipt(payment);
	} catch (error) {
		return reply.code(503).send({
			error:
				error instanceof Error
					? error.message
					: "Google Cloud TTS receipt generation failed.",
		});
	}
});

await app.listen({ host: env.HOST, port: env.PORT });
