import Fastify from "fastify";
import { verifyPassword } from "./auth/passwords.js";
import {
	buildExpiredSessionCookie,
	buildSessionCookie,
	parseCookie,
	RedisSessionStore,
} from "./auth/sessions.js";
import { env } from "./config.js";
import { createPool } from "./db.js";
import { UsersRepository } from "./repositories/users.js";
import {
	createAccountSchema,
	loginSchema,
	upsertContactSchema,
	userParamsSchema,
	walletParamsSchema,
} from "./schemas.js";

const app = Fastify({
	logger: {
		level: env.LOG_LEVEL,
	},
});
const users = env.DATABASE_URL
	? new UsersRepository(createPool(env.DATABASE_URL))
	: undefined;
const sessions = env.REDIS_URL
	? new RedisSessionStore(env.REDIS_URL)
	: undefined;

app.addHook("onRequest", async (_request, reply) => {
	const origin = _request.headers.origin;
	const isLocalOrigin =
		origin?.startsWith("http://127.0.0.1") ||
		origin?.startsWith("http://localhost");

	if (origin && isLocalOrigin) {
		reply.header("Access-Control-Allow-Origin", origin);
		reply.header("Access-Control-Allow-Credentials", "true");
	}

	reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	reply.header("Access-Control-Allow-Headers", "Content-Type");
});

app.options("/*", async (_request, reply) => reply.code(204).send());

app.get("/health", async () => ({
	ok: true,
	service: "payproof-backend",
	postgresConfigured: Boolean(env.DATABASE_URL),
	redisConfigured: Boolean(env.REDIS_URL),
}));

app.post("/auth/login", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	if (!sessions) {
		return reply.code(503).send({ error: "REDIS_URL is not configured." });
	}

	const input = loginSchema.parse(request.body);
	const authUser = await users.findAuthUserByEmail(input.email);

	if (!authUser || !verifyPassword(input.password, authUser.passwordHash)) {
		return reply.code(401).send({ error: "Invalid credentials." });
	}

	const sessionId = await sessions.create(
		authUser.user.id,
		env.SESSION_TTL_SECONDS,
	);
	const contacts = await users.listContacts(authUser.user.id);
	const keyterms = await users.getAssemblyAiKeyterms(authUser.user.id);

	reply.header(
		"Set-Cookie",
		buildSessionCookie({
			name: env.SESSION_COOKIE_NAME,
			value: sessionId,
			maxAgeSeconds: env.SESSION_TTL_SECONDS,
		}),
	);

	return {
		user: authUser.user,
		contacts,
		keyterms,
	};
});

app.get("/auth/session", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	if (!sessions) {
		return reply.code(503).send({ error: "REDIS_URL is not configured." });
	}

	const sessionId = parseCookie(
		request.headers.cookie,
		env.SESSION_COOKIE_NAME,
	);
	const session = sessionId ? await sessions.get(sessionId) : null;

	if (!session) {
		return reply.code(401).send({ error: "No active session." });
	}

	const user = await users.findUserById(session.userId);
	if (!user) {
		return reply.code(401).send({ error: "Session user not found." });
	}

	const contacts = await users.listContacts(user.id);
	const keyterms = await users.getAssemblyAiKeyterms(user.id);

	return {
		user,
		contacts,
		keyterms,
	};
});

app.post("/auth/logout", async (request, reply) => {
	const sessionId = parseCookie(
		request.headers.cookie,
		env.SESSION_COOKIE_NAME,
	);

	if (sessionId && sessions) {
		await sessions.delete(sessionId);
	}

	reply.header(
		"Set-Cookie",
		buildExpiredSessionCookie(env.SESSION_COOKIE_NAME),
	);
	return { ok: true };
});

app.post("/accounts", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const input = createAccountSchema.parse(request.body);
	return {
		user: await users.upsertUser(input),
	};
});

app.get("/users/by-wallet/:walletAddress", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const params = walletParamsSchema.parse(request.params);
	const result = await users.findUserWithContactsByWallet(params.walletAddress);

	if (!result.user) {
		return reply.code(404).send({
			error: "User not found.",
		});
	}

	return result;
});

app.post("/users/:userId/contacts", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const params = userParamsSchema.parse(request.params);
	const input = upsertContactSchema.parse(request.body);
	return {
		contact: await users.upsertContact(params.userId, input),
	};
});

app.get("/users/:userId/contacts", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const params = userParamsSchema.parse(request.params);
	return {
		contacts: await users.listContacts(params.userId),
	};
});

app.get("/users/:userId/assemblyai-keyterms", async (request, reply) => {
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const params = userParamsSchema.parse(request.params);
	return users.getAssemblyAiKeyterms(params.userId);
});

await app.listen({ host: env.BACKEND_HOST, port: env.BACKEND_PORT });
