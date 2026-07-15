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
import { VoiceReceiptService } from "./modules/voice/receipt.js";

const app = Fastify({
	logger: {
		level: process.env.LOG_LEVEL ?? "info",
	},
});

const paymentApplication = new PaymentApplication(
	new PaymentIntentParser({
		apiKey: env.GEMINI_API_KEY,
		model: env.GEMINI_MODEL,
	}),
);
const assemblyAi = new AssemblyAiService(env.ASSEMBLYAI_API_KEY);
const voiceReceipt = new VoiceReceiptService(
	env.GEMINI_API_KEY,
	env.GEMINI_TTS_MODEL,
);
const paymentCoordinator = createPaymentCoordinatorAgent({
	preparePayment: (input) => paymentApplication.prepare(input),
});

app.get("/health", async () => ({
	ok: true,
	service: "payproof-agent",
	ai: {
		geminiConfigured: Boolean(env.GEMINI_API_KEY),
		assemblyAiConfigured: Boolean(env.ASSEMBLYAI_API_KEY),
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
	const body = z.object({ audioUrl: z.string().url() }).parse(request.body);
	try {
		return await assemblyAi.transcribeUrl(body.audioUrl);
	} catch (error) {
		return reply.code(503).send({
			error:
				error instanceof Error
					? error.message
					: "AssemblyAI transcription failed.",
		});
	}
});

app.post("/voice/receipt", async (request) => {
	const payment = preparePaymentResponseSchema.parse(request.body);
	return voiceReceipt.generateReceipt(payment);
});

await app.listen({ host: env.HOST, port: env.PORT });
