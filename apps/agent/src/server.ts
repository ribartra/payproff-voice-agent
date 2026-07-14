import { CELO_CHAINS } from "@payproof/celo";
import Fastify from "fastify";
import { z } from "zod";

const envSchema = z.object({
	HOST: z.string().default("127.0.0.1"),
	PORT: z.coerce.number().int().positive().default(3001),
});

const env = envSchema.parse(process.env);

const app = Fastify({
	logger: {
		level: process.env.LOG_LEVEL ?? "info",
	},
});

app.get("/health", async () => ({
	ok: true,
	service: "payproof-agent",
	chains: {
		celo: CELO_CHAINS.mainnet.id,
		celoSepolia: CELO_CHAINS.testnet.id,
	},
}));

await app.listen({ host: env.HOST, port: env.PORT });
