import { randomBytes } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

const SESSION_PREFIX = "payproof:session:";
const WALLET_CHALLENGE_PREFIX = "payproof:wallet-challenge:";

export type SessionData = {
	userId: string;
	createdAt: string;
};

export class RedisSessionStore {
	private readonly client: RedisClientType;

	constructor(redisUrl: string) {
		this.client = createClient({ url: redisUrl });
	}

	async connect(): Promise<void> {
		if (!this.client.isOpen) {
			await this.client.connect();
		}
	}

	async create(userId: string, ttlSeconds: number): Promise<string> {
		await this.connect();
		const sessionId = randomBytes(32).toString("hex");
		const session: SessionData = {
			userId,
			createdAt: new Date().toISOString(),
		};

		await this.client.setEx(
			`${SESSION_PREFIX}${sessionId}`,
			ttlSeconds,
			JSON.stringify(session),
		);

		return sessionId;
	}

	async get(sessionId: string): Promise<SessionData | null> {
		await this.connect();
		const raw = await this.client.get(`${SESSION_PREFIX}${sessionId}`);
		return raw ? (JSON.parse(raw) as SessionData) : null;
	}

	async delete(sessionId: string): Promise<void> {
		await this.connect();
		await this.client.del(`${SESSION_PREFIX}${sessionId}`);
	}

	async createWalletChallenge(params: {
		userId: string;
		walletAddress: `0x${string}`;
		chainId: number;
		message: string;
		ttlSeconds: number;
	}): Promise<string> {
		await this.connect();
		const challengeId = randomBytes(24).toString("hex");
		await this.client.setEx(
			`${WALLET_CHALLENGE_PREFIX}${challengeId}`,
			params.ttlSeconds,
			JSON.stringify({
				userId: params.userId,
				walletAddress: params.walletAddress,
				chainId: params.chainId,
				message: params.message,
				createdAt: new Date().toISOString(),
			}),
		);
		return challengeId;
	}

	async consumeWalletChallenge(challengeId: string): Promise<{
		userId: string;
		walletAddress: `0x${string}`;
		chainId: number;
		message: string;
		createdAt: string;
	} | null> {
		await this.connect();
		const key = `${WALLET_CHALLENGE_PREFIX}${challengeId}`;
		const raw = await this.client.get(key);
		if (!raw) {
			return null;
		}
		await this.client.del(key);
		return JSON.parse(raw) as {
			userId: string;
			walletAddress: `0x${string}`;
			chainId: number;
			message: string;
			createdAt: string;
		};
	}
}

export function parseCookie(
	header: string | undefined,
	name: string,
): string | undefined {
	return header
		?.split(";")
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${name}=`))
		?.slice(name.length + 1);
}

export function buildSessionCookie(params: {
	name: string;
	value: string;
	maxAgeSeconds: number;
}): string {
	return [
		`${params.name}=${params.value}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${params.maxAgeSeconds}`,
	].join("; ");
}

export function buildExpiredSessionCookie(name: string): string {
	return [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join(
		"; ",
	);
}
