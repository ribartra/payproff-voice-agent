import websocket from "@fastify/websocket";
import { CELO_TOKENS } from "@payproof/celo";
import {
	type PreparePaymentResponse,
	paymentSubmissionRequestSchema,
	preparePaymentRequestSchema,
	type RealtimeEventType,
} from "@payproof/domain";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { verifyMessage } from "viem";
import { verifyPassword } from "./auth/passwords.js";
import {
	buildExpiredSessionCookie,
	buildSessionCookie,
	parseCookie,
	RedisSessionStore,
} from "./auth/sessions.js";
import { env } from "./config.js";
import { createPool } from "./db.js";
import {
	createRealtimeEnvelope,
	RealtimeRepository,
	RedisRealtimePublisher,
} from "./realtime.js";
import {
	createRequestHash,
	IdempotencyConflictError,
	PaymentsRepository,
} from "./repositories/payments.js";
import { UsersRepository } from "./repositories/users.js";
import {
	createAccountSchema,
	loginSchema,
	paymentParamsSchema,
	upsertContactSchema,
	userParamsSchema,
	walletChallengeRequestSchema,
	walletLinkWithChallengeSchema,
	walletParamsSchema,
} from "./schemas.js";

const app = Fastify({
	logger: {
		level: env.LOG_LEVEL,
	},
});
await app.register(websocket);

const pool = env.DATABASE_URL ? createPool(env.DATABASE_URL) : undefined;
const users = pool ? new UsersRepository(pool) : undefined;
const payments = pool ? new PaymentsRepository(pool) : undefined;
const realtime = pool
	? new RealtimeRepository(pool, env.REALTIME_EVENT_TTL_SECONDS)
	: undefined;
const sessions = env.REDIS_URL
	? new RedisSessionStore(env.REDIS_URL)
	: undefined;
const realtimePublisher = env.REDIS_URL
	? new RedisRealtimePublisher(env.REDIS_URL)
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

	reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
	reply.header("Access-Control-Allow-Headers", "Content-Type");
});

app.options("/*", async (_request, reply) => reply.code(204).send());

app.get("/health", async () => ({
	ok: true,
	service: "payproof-backend",
	postgresConfigured: Boolean(env.DATABASE_URL),
	redisConfigured: Boolean(env.REDIS_URL),
	paymentManagerConfigured: Boolean(env.PAYMENT_MANAGER_ADDRESS),
}));

app.get("/health/realtime", async () => ({
	ok: Boolean(realtime && realtimePublisher && sessions),
	service: "payproof-backend-realtime",
	postgresConfigured: Boolean(env.DATABASE_URL),
	redisConfigured: Boolean(env.REDIS_URL),
	path: "/ws",
}));

app.get("/health/indexer", async () => ({
	ok: false,
	service: "payproof-chain-indexer",
	configured: false,
	reason:
		"RPC HTTP/WSS, deployment block and PAYMENT_MANAGER_ADDRESS are required before starting the indexer.",
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

app.post("/auth/wallet/challenge", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!sessions) {
		return reply.code(503).send({ error: "REDIS_URL is not configured." });
	}

	const input = walletChallengeRequestSchema.parse(request.body);
	const issuedAt = new Date();
	const expiresAt = new Date(
		issuedAt.getTime() + env.WALLET_CHALLENGE_TTL_SECONDS * 1000,
	);
	const message = [
		"PayProof wallet link",
		`User: ${session.user.id}`,
		`Wallet: ${input.walletAddress}`,
		`Chain ID: ${input.chainId}`,
		`Network: ${input.network}`,
		`Issued At: ${issuedAt.toISOString()}`,
		`Expires At: ${expiresAt.toISOString()}`,
	].join("\n");
	const challengeId = await sessions.createWalletChallenge({
		userId: session.user.id,
		walletAddress: input.walletAddress,
		chainId: input.chainId,
		message,
		ttlSeconds: env.WALLET_CHALLENGE_TTL_SECONDS,
	});

	return {
		challengeId,
		message,
		expiresAt: expiresAt.toISOString(),
	};
});

app.post("/auth/wallet/link", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!users) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	if (!sessions) {
		return reply.code(503).send({ error: "REDIS_URL is not configured." });
	}

	const input = walletLinkWithChallengeSchema.parse(request.body);
	const challenge = await sessions.consumeWalletChallenge(input.challengeId);
	if (!challenge || challenge.userId !== session.user.id) {
		return reply.code(400).send({ error: "Invalid or expired challenge." });
	}
	if (
		challenge.message !== input.message ||
		challenge.chainId !== input.chainId ||
		challenge.walletAddress.toLowerCase() !== input.walletAddress.toLowerCase()
	) {
		return reply.code(400).send({ error: "Challenge payload mismatch." });
	}

	const valid = await verifyMessage({
		address: input.walletAddress,
		message: input.message,
		signature: input.signature,
	});
	if (!valid) {
		return reply.code(401).send({ error: "Invalid wallet signature." });
	}

	const user = await users.linkWallet({
		userId: session.user.id,
		walletAddress: input.walletAddress,
		network: input.network,
	});
	await emitRealtime({
		userId: user.id,
		aggregateId: user.id,
		type: "user.updated",
		payload: {
			userId: user.id,
			walletAddress: user.walletAddress,
			updatedAt: user.updatedAt,
		},
	});
	const contacts = await users.listContacts(user.id);
	const keyterms = await users.getAssemblyAiKeyterms(user.id);

	return { user, contacts, keyterms };
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
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (session.user.id !== params.userId) {
		return reply.code(403).send({ error: "Cannot edit another user." });
	}
	const contact = await users.upsertContact(params.userId, input);
	const keyterms = await users.getAssemblyAiKeyterms(params.userId);
	await emitRealtime({
		userId: params.userId,
		aggregateId: contact.id,
		type: "contact.updated",
		payload: {
			contact,
			keytermsPrompt: keyterms.keytermsPrompt,
		},
	});
	return {
		contact,
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

app.post("/payments/preparations", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}

	const input = preparePaymentRequestSchema.parse(request.body);
	if (
		input.userWallet.toLowerCase() !== session.user.walletAddress.toLowerCase()
	) {
		return reply.code(403).send({
			error: "Connected payment wallet must match the session user wallet.",
		});
	}
	if (!input.idempotencyKey) {
		return reply.code(400).send({ error: "idempotencyKey is required." });
	}

	const requestHash = createRequestHash(input);
	const existing = await payments.findByIdempotency({
		userWallet: input.userWallet,
		idempotencyKey: input.idempotencyKey,
	});
	if (existing) {
		if (existing.requestHash !== requestHash) {
			return reply.code(409).send({ error: "IDEMPOTENCY_CONFLICT" });
		}
		return existing;
	}

	try {
		const agentResponse = await fetch(`${env.AGENT_URL}/payments/prepare`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
		const body = (await agentResponse.json()) as PreparePaymentResponse & {
			error?: string;
		};

		if (!agentResponse.ok) {
			return reply
				.code(agentResponse.status)
				.send({ error: body.error ?? "Agent payment preparation failed." });
		}

		const token =
			CELO_TOKENS[input.network === "celo" ? "mainnet" : "testnet"][
				body.intent.token
			];
		const record = await payments.insertPreparation({
			userId: session.user.id,
			request: input,
			requestHash,
			response: body,
			tokenDecimals: token.decimals,
			contractAddress: env.PAYMENT_MANAGER_ADDRESS as `0x${string}` | undefined,
		});
		await payments.recordPaymentEvent({
			paymentId: record.paymentId,
			userId: session.user.id,
			eventType:
				record.state === "awaiting_confirmation"
					? "payment.prepared"
					: "payment.requires_review",
			payload: record,
		});
		await emitRealtime({
			userId: session.user.id,
			aggregateId: record.paymentId,
			type:
				record.state === "awaiting_confirmation"
					? "payment.prepared"
					: "payment.requires_review",
			payload: record,
		});

		return record;
	} catch (error) {
		if (error instanceof IdempotencyConflictError) {
			return reply.code(409).send({ error: "IDEMPOTENCY_CONFLICT" });
		}
		throw error;
	}
});

app.get("/payments/:paymentId", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	const params = paymentParamsSchema.parse(request.params);
	const payment = await payments.findByPaymentId(params.paymentId);
	if (!payment || payment.userId !== session.user.id) {
		return reply.code(404).send({ error: "Payment not found." });
	}
	return payment;
});

app.post("/payments/:paymentId/submissions", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	const params = paymentParamsSchema.parse(request.params);
	const payment = await payments.findByPaymentId(params.paymentId);
	if (!payment || payment.userId !== session.user.id) {
		return reply.code(404).send({ error: "Payment not found." });
	}

	const submission = paymentSubmissionRequestSchema.parse(request.body);
	if (submission.chainId !== payment.chainId) {
		return reply.code(400).send({ error: "Submission chain mismatch." });
	}
	if (
		submission.fromAddress.toLowerCase() !== payment.userWallet.toLowerCase()
	) {
		return reply.code(400).send({ error: "Submission payer mismatch." });
	}
	if (
		submission.toAddress.toLowerCase() !==
		(payment.contractAddress ?? submission.toAddress).toLowerCase()
	) {
		return reply.code(400).send({ error: "Submission contract mismatch." });
	}

	const transaction = await payments.submitTransaction({ payment, submission });
	await payments.recordPaymentEvent({
		paymentId: payment.paymentId,
		userId: session.user.id,
		eventType: "payment.submitted",
		payload: transaction,
	});
	await emitRealtime({
		userId: session.user.id,
		aggregateId: payment.paymentId,
		type: "payment.submitted",
		payload: transaction,
	});
	return { transaction };
});

app.post("/payments/:paymentId/reconcile", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	const params = paymentParamsSchema.parse(request.params);
	const payment = await payments.findByPaymentId(params.paymentId);
	if (!payment || payment.userId !== session.user.id) {
		return reply.code(404).send({ error: "Payment not found." });
	}
	return {
		payment,
		reconciled: false,
		reason:
			"RPC HTTP/WSS and indexer configuration are required to reconcile onchain state.",
	};
});

app.get("/payments/:paymentId/receipt", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	const params = paymentParamsSchema.parse(request.params);
	const payment = await payments.findByPaymentId(params.paymentId);
	if (!payment || payment.userId !== session.user.id) {
		return reply.code(404).send({ error: "Payment not found." });
	}
	return {
		paymentId: payment.paymentId,
		state: payment.state,
		chainId: payment.chainId,
		token: payment.tokenSymbol,
		amount: payment.amountDisplay,
		amountBaseUnits: payment.amountBaseUnits,
		payer: payment.userWallet,
		recipient: payment.recipientAddress,
		mandateHash: payment.mandateHash,
		contractAddress: payment.contractAddress,
		expiresAt: payment.expiresAt,
		createdAt: payment.createdAt,
		updatedAt: payment.updatedAt,
	};
});

app.get("/users/:userId/payments", async (request, reply) => {
	const session = await requireSession(request, reply);
	if (!session) {
		return;
	}
	if (!payments) {
		return reply.code(503).send({ error: "DATABASE_URL is not configured." });
	}
	const params = userParamsSchema.parse(request.params);
	if (session.user.id !== params.userId) {
		return reply
			.code(403)
			.send({ error: "Cannot list another user payments." });
	}
	return { payments: await payments.listByUser(params.userId) };
});

app.get("/ws", { websocket: true }, async (connection, request) => {
	if (!sessions || !users || !realtime || !realtimePublisher) {
		connection.close(1011, "Realtime is not configured.");
		return;
	}

	const sessionId = parseCookie(
		request.headers.cookie,
		env.SESSION_COOKIE_NAME,
	);
	const session = sessionId ? await sessions.get(sessionId) : null;
	const user = session ? await users.findUserById(session.userId) : null;
	if (!user) {
		connection.close(1008, "No active session.");
		return;
	}

	let unsubscribe: (() => Promise<void>) | undefined;
	connection.on("message", async (raw: Buffer | ArrayBuffer | string) => {
		const message = JSON.parse(String(raw)) as {
			type?: string;
			lastEventId?: string;
		};
		if (message.type !== "subscribe") {
			return;
		}
		const missed = await realtime.listAfter({
			userId: user.id,
			lastEventId: message.lastEventId,
		});
		for (const event of missed) {
			connection.send(JSON.stringify(event));
		}
		unsubscribe ??= await realtimePublisher.subscribe(user.id, (event) => {
			connection.send(JSON.stringify(event));
		});
	});
	connection.on("close", () => {
		void unsubscribe?.();
	});
	connection.send(
		JSON.stringify({
			type: "ready",
			version: 1,
			userId: user.id,
			occurredAt: new Date().toISOString(),
		}),
	);
});

await app.listen({ host: env.BACKEND_HOST, port: env.BACKEND_PORT });

async function requireSession(request: FastifyRequest, reply: FastifyReply) {
	if (!users) {
		reply.code(503).send({ error: "DATABASE_URL is not configured." });
		return null;
	}
	if (!sessions) {
		reply.code(503).send({ error: "REDIS_URL is not configured." });
		return null;
	}
	const sessionId = parseCookie(
		request.headers.cookie,
		env.SESSION_COOKIE_NAME,
	);
	const session = sessionId ? await sessions.get(sessionId) : null;
	if (!session) {
		reply.code(401).send({ error: "No active session." });
		return null;
	}
	const user = await users.findUserById(session.userId);
	if (!user) {
		reply.code(401).send({ error: "Session user not found." });
		return null;
	}
	return { session, user };
}

async function emitRealtime(input: {
	userId: string;
	aggregateId: string;
	type: RealtimeEventType;
	payload: unknown;
}) {
	if (!realtime || !realtimePublisher) {
		return;
	}
	const event = createRealtimeEnvelope(input);
	await realtime.store(event);
	await realtime.storeOutbox(event);
	await realtimePublisher.publish(event);
}
