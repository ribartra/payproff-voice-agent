import { randomBytes } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

const SESSION_PREFIX = "payproof:session:";

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
