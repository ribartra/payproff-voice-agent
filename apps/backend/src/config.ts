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
		DATABASE_URL: z.string().default(""),
		LOG_LEVEL: z.string().default("info"),
		REDIS_URL: z.string().default(""),
		SESSION_COOKIE_NAME: z.string().default("pp_session"),
		SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
	})
	.parse(process.env);
