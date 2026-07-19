import { describe, expect, test } from "bun:test";
import { UsersRepository } from "./users.js";

describe("UsersRepository", () => {
	test("upserts a user, contact and exposes contact aliases as AssemblyAI keyterms", async () => {
		const db = new MemoryDb();
		const repository = new UsersRepository(db);

		const user = await repository.upsertUser({
			displayName: "Demo User",
			email: "demo@payproof.local",
			password: "PayProofDemo2026!",
			walletAddress: "0x1111111111111111111111111111111111111111",
			network: "celo-sepolia",
		});
		const contact = await repository.upsertContact(user.id, {
			alias: "proveedor",
			walletAddress: "0x2222222222222222222222222222222222222222",
			network: "celo-sepolia",
			preferredToken: "USDC",
		});
		const result = await repository.findUserWithContactsByWallet(
			"0x1111111111111111111111111111111111111111",
		);
		const keyterms = await repository.getAssemblyAiKeyterms(user.id);

		expect(contact.alias).toBe("proveedor");
		expect(user.email).toBe("demo@payproof.local");
		expect(result.user?.id).toBe(user.id);
		expect(result.contacts).toHaveLength(1);
		expect(keyterms.keytermsPrompt).toEqual(["proveedor"]);
		expect(keyterms.maxTerms).toBe(100);
	});
});

type Row = Record<string, unknown>;

class MemoryDb {
	private users: Row[] = [];
	private contacts: Row[] = [];

	async query<T extends Row>(
		sql: string,
		params: unknown[],
	): Promise<{ rows: T[] }> {
		if (sql.includes("insert into payproof_users")) {
			const existing = this.users.find(
				(user) =>
					String(user.wallet_address).toLowerCase() ===
					String(params[4]).toLowerCase(),
			);
			const row =
				existing ??
				createUserRow({
					id: String(params[0]),
					displayName: String(params[1]),
					email: String(params[2]),
					passwordHash: String(params[3]),
					walletAddress: String(params[4]),
					network: String(params[5]),
				});
			row.display_name = String(params[1]);
			row.email = String(params[2]);
			row.network = String(params[5]);

			if (!existing) {
				this.users.push(row);
			}

			return { rows: [row as T] };
		}

		if (sql.includes("from payproof_users")) {
			const row = sql.includes("where id =")
				? this.users.find((user) => user.id === params[0])
				: sql.includes("where lower(email)")
					? this.users.find(
							(user) =>
								String(user.email).toLowerCase() ===
								String(params[0]).toLowerCase(),
						)
					: this.users.find(
							(user) =>
								String(user.wallet_address).toLowerCase() ===
								String(params[0]).toLowerCase(),
						);
			return { rows: row ? [row as T] : [] };
		}

		if (sql.includes("insert into payproof_contacts")) {
			const existing = this.contacts.find(
				(contact) =>
					contact.user_id === params[1] &&
					String(contact.alias).toLowerCase() ===
						String(params[2]).toLowerCase(),
			);
			const row =
				existing ??
				createContactRow({
					id: String(params[0]),
					userId: String(params[1]),
					alias: String(params[2]),
					walletAddress: String(params[3]),
					network: String(params[4]),
					preferredToken: String(params[5]),
				});
			row.wallet_address = String(params[3]);
			row.network = String(params[4]);
			row.preferred_token = String(params[5]);

			if (!existing) {
				this.contacts.push(row);
			}

			return { rows: [row as T] };
		}

		if (sql.includes("from payproof_contacts")) {
			return {
				rows: this.contacts
					.filter((contact) => contact.user_id === params[0])
					.toSorted((left, right) =>
						String(left.alias).localeCompare(String(right.alias)),
					) as T[],
			};
		}

		throw new Error(`Unhandled SQL in test: ${sql}`);
	}
}

function createUserRow(params: {
	id: string;
	displayName: string;
	email: string;
	passwordHash: string;
	walletAddress: string;
	network: string;
}) {
	const now = new Date("2026-07-18T00:00:00.000Z");
	return {
		id: params.id,
		display_name: params.displayName,
		email: params.email,
		password_hash: params.passwordHash,
		wallet_address: params.walletAddress,
		network: params.network,
		created_at: now,
		updated_at: now,
	};
}

function createContactRow(params: {
	id: string;
	userId: string;
	alias: string;
	walletAddress: string;
	network: string;
	preferredToken: string;
}) {
	const now = new Date("2026-07-18T00:00:00.000Z");
	return {
		id: params.id,
		user_id: params.userId,
		alias: params.alias,
		wallet_address: params.walletAddress,
		network: params.network,
		preferred_token: params.preferredToken,
		created_at: now,
		updated_at: now,
	};
}
