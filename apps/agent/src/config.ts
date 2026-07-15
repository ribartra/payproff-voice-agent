import { z } from "zod";

export const envSchema = z.object({
	HOST: z.string().default("127.0.0.1"),
	PORT: z.coerce.number().int().positive().default(3001),
	LOG_LEVEL: z.string().default("info"),
	GEMINI_API_KEY: z.string().min(1).optional(),
	GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
	GEMINI_TTS_MODEL: z.string().min(1).default("gemini-2.5-flash-preview-tts"),
	ASSEMBLYAI_API_KEY: z.string().min(1).optional(),
	ASSEMBLYAI_TOKEN_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.max(3600)
		.default(600),
});

export type AgentEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
