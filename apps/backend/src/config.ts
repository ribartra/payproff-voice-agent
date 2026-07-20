import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(currentDir, "../../../.env") });
loadEnv({ path: resolve(currentDir, "../.env"), override: true });

export const env = z
	.object({
		BACKEND_HOST: z.string().default("127.0.0.1"),
		BACKEND_PORT: z.coerce.number().int().positive().default(3002),
		AGENT_URL: z.string().url().default("http://127.0.0.1:3001"),
		DATABASE_URL: z.string().default(""),
		LOG_LEVEL: z.string().default("info"),
		PAYMENT_MANAGER_ADDRESS: z
			.string()
			.regex(/^0x[a-fA-F0-9]{40}$/)
			.optional(),
		REDIS_URL: z.string().default(""),
		REALTIME_EVENT_TTL_SECONDS: z.coerce
			.number()
			.int()
			.positive()
			.default(86_400),
		WALLET_CHALLENGE_TTL_SECONDS: z.coerce
			.number()
			.int()
			.positive()
			.default(300),
		SESSION_COOKIE_NAME: z.string().default("pp_session"),
		SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
	})
	.parse(process.env);
