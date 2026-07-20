import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { hashPassword } from "../auth/passwords.js";
import type { Queryable } from "../db.js";
import { buildAssemblyAiKeyterms } from "../keyterms.js";
import type {
	CreateAccountInput,
	PayproofContact,
	PayproofUser,
	UpsertContactInput,
} from "../schemas.js";

type UserRow = QueryResultRow & {
	id: string;
	display_name: string;
	email: string;
	password_hash: string;
	wallet_address: `0x${string}`;
	network: "celo-sepolia" | "celo";
	created_at: Date | string;
	updated_at: Date | string;
};

type ContactRow = QueryResultRow & {
	id: string;
	user_id: string;
	alias: string;
	wallet_address: `0x${string}`;
	network: "celo-sepolia" | "celo";
	preferred_token: "USDC" | "USDm";
	created_at: Date | string;
	updated_at: Date | string;
};

export class UsersRepository {
	constructor(private readonly db: Queryable) {}

	async upsertUser(input: CreateAccountInput): Promise<PayproofUser> {
		const passwordHash = input.password
			? hashPassword(input.password)
			: hashPassword(randomUUID());
		const result = await this.db.query<UserRow>(
			`
				insert into payproof_users (
					id,
					display_name,
					email,
					password_hash,
					wallet_address,
					network
				)
				values ($1, $2, $3, $4, $5, $6)
				on conflict (lower(wallet_address)) do update
				set
					display_name = excluded.display_name,
					email = excluded.email,
					network = excluded.network,
					updated_at = now()
				returning *
			`,
			[
				randomUUID(),
				input.displayName,
				input.email,
				passwordHash,
				input.walletAddress,
				input.network,
			],
		);

		return mapUser(result.rows[0]);
	}

	async findUserById(userId: string): Promise<PayproofUser | null> {
		const result = await this.db.query<UserRow>(
			`
				select *
				from payproof_users
				where id = $1
				limit 1
			`,
			[userId],
		);

		return result.rows[0] ? mapUser(result.rows[0]) : null;
	}

	async findAuthUserByEmail(email: string): Promise<{
		user: PayproofUser;
		passwordHash: string;
	} | null> {
		const result = await this.db.query<UserRow>(
			`
				select *
				from payproof_users
				where lower(email) = lower($1)
				limit 1
			`,
			[email],
		);
		const row = result.rows[0];

		if (!row) {
			return null;
		}

		return {
			user: mapUser(row),
			passwordHash: row.password_hash,
		};
	}

	async findUserWithContactsByWallet(walletAddress: `0x${string}`): Promise<{
		user: PayproofUser | null;
		contacts: PayproofContact[];
	}> {
		const users = await this.db.query<UserRow>(
			`
				select *
				from payproof_users
				where lower(wallet_address) = lower($1)
				limit 1
			`,
			[walletAddress],
		);

		const row = users.rows[0];
		if (!row) {
			return { user: null, contacts: [] };
		}

		const contacts = await this.listContacts(row.id);
		return {
			user: mapUser(row),
			contacts,
		};
	}

	async linkWallet(params: {
		userId: string;
		walletAddress: `0x${string}`;
		network: "celo-sepolia" | "celo";
	}): Promise<PayproofUser> {
		const result = await this.db.query<UserRow>(
			`
				update payproof_users
				set
					wallet_address = $2,
					network = $3,
					updated_at = now()
				where id = $1
				returning *
			`,
			[params.userId, params.walletAddress, params.network],
		);

		if (!result.rows[0]) {
			throw new Error("User not found.");
		}

		return mapUser(result.rows[0]);
	}

	async upsertContact(
		userId: string,
		input: UpsertContactInput,
	): Promise<PayproofContact> {
		const result = await this.db.query<ContactRow>(
			`
				insert into payproof_contacts (
					id,
					user_id,
					alias,
					wallet_address,
					network,
					preferred_token
				)
				values ($1, $2, $3, $4, $5, $6)
				on conflict (user_id, lower(alias)) do update
				set
					wallet_address = excluded.wallet_address,
					network = excluded.network,
					preferred_token = excluded.preferred_token,
					updated_at = now()
				returning *
			`,
			[
				randomUUID(),
				userId,
				input.alias,
				input.walletAddress,
				input.network,
				input.preferredToken,
			],
		);

		return mapContact(result.rows[0]);
	}

	async listContacts(userId: string): Promise<PayproofContact[]> {
		const result = await this.db.query<ContactRow>(
			`
				select *
				from payproof_contacts
				where user_id = $1
				order by lower(alias) asc
			`,
			[userId],
		);

		return result.rows.map(mapContact);
	}

	async getAssemblyAiKeyterms(userId: string): Promise<{
		keytermsPrompt: string[];
		contacts: PayproofContact[];
		maxTerms: number;
	}> {
		const contacts = await this.listContacts(userId);
		return {
			keytermsPrompt: buildAssemblyAiKeyterms(contacts),
			contacts,
			maxTerms: 100,
		};
	}
}

function mapUser(row: UserRow): PayproofUser {
	return {
		id: row.id,
		displayName: row.display_name,
		email: row.email,
		walletAddress: row.wallet_address,
		network: row.network,
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at),
	};
}

function mapContact(row: ContactRow): PayproofContact {
	return {
		id: row.id,
		userId: row.user_id,
		alias: row.alias,
		walletAddress: row.wallet_address,
		network: row.network,
		preferredToken: row.preferred_token,
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at),
	};
}

function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}
