import { randomUUID } from "node:crypto";
import {
	canonicalJson,
	type PaymentSubmissionRequest,
	type PaymentTransactionRecord,
	type PreparedPaymentRecord,
	type PreparePaymentRequest,
	type PreparePaymentResponse,
} from "@payproof/domain";
import { keccak256, toBytes } from "viem";
import type { Queryable } from "../db.js";

type PreparationRow = {
	id: string;
	payment_id: string;
	user_id: string;
	user_wallet: `0x${string}`;
	network: "celo-sepolia" | "celo";
	chain_id: number;
	token_symbol: "USDC" | "USDm";
	token_address: `0x${string}`;
	token_decimals: number;
	recipient_address: `0x${string}`;
	amount_base_units: string;
	amount_display: string;
	idempotency_key: string | null;
	request_hash: `0x${string}`;
	mandate_hash: `0x${string}` | null;
	contract_address: `0x${string}` | null;
	policy_decision: unknown;
	state: PreparedPaymentRecord["state"];
	response_json: unknown;
	expires_at: Date | string;
	created_at: Date | string;
	updated_at: Date | string;
};

type TransactionRow = {
	id: string;
	payment_id: string;
	tx_hash: `0x${string}`;
	chain_id: number;
	contract_address: `0x${string}`;
	from_address: `0x${string}`;
	to_address: `0x${string}`;
	status: PaymentTransactionRecord["status"];
	block_number: string | null;
	block_hash: `0x${string}` | null;
	confirmations: number | null;
	error_code: string | null;
	error_message: string | null;
	submitted_at: Date | string;
	confirmed_at: Date | string | null;
};

export class IdempotencyConflictError extends Error {
	constructor() {
		super("IDEMPOTENCY_CONFLICT");
	}
}

export class PaymentsRepository {
	constructor(private readonly db: Queryable) {}

	async findByPaymentId(
		paymentId: string,
	): Promise<PreparedPaymentRecord | null> {
		const result = await this.db.query<PreparationRow>(
			`
				select *
				from payproof_payment_preparations
				where payment_id = $1
				limit 1
			`,
			[paymentId],
		);
		return result.rows[0] ? mapPreparation(result.rows[0]) : null;
	}

	async findByIdempotency(params: {
		userWallet: `0x${string}`;
		idempotencyKey: string;
	}): Promise<PreparedPaymentRecord | null> {
		const result = await this.db.query<PreparationRow>(
			`
				select *
				from payproof_payment_preparations
				where lower(user_wallet) = lower($1) and idempotency_key = $2
				limit 1
			`,
			[params.userWallet, params.idempotencyKey],
		);
		return result.rows[0] ? mapPreparation(result.rows[0]) : null;
	}

	async insertPreparation(params: {
		userId: string;
		request: PreparePaymentRequest;
		requestHash: `0x${string}`;
		response: PreparePaymentResponse;
		tokenDecimals: number;
		contractAddress?: `0x${string}`;
	}): Promise<PreparedPaymentRecord> {
		const mandate = params.response.paymentMandate;
		const checkout = params.response.checkoutMandate;

		if (!mandate || !checkout || !params.response.policy.mandateHash) {
			throw new Error("Only approved payment preparations can be persisted.");
		}

		const result = await this.db.query<PreparationRow>(
			`
				insert into payproof_payment_preparations (
					id,
					payment_id,
					user_id,
					user_wallet,
					network,
					chain_id,
					token_symbol,
					token_address,
					token_decimals,
					recipient_address,
					amount_base_units,
					amount_display,
					idempotency_key,
					request_hash,
					mandate_hash,
					contract_address,
					policy_decision,
					state,
					response_json,
					expires_at
				)
				values (
					$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
					$11, $12, $13, $14, $15, $16, $17, $18, $19, $20
				)
				returning *
			`,
			[
				randomUUID(),
				params.response.paymentId,
				params.userId,
				params.request.userWallet,
				params.request.network,
				mandate.chainId,
				params.response.intent.token,
				mandate.tokenAddress,
				params.tokenDecimals,
				mandate.payee,
				mandate.amountBaseUnits,
				params.response.intent.amount,
				params.request.idempotencyKey ?? null,
				params.requestHash,
				params.response.policy.mandateHash,
				params.contractAddress ?? null,
				JSON.stringify(params.response.policy),
				params.response.state,
				JSON.stringify(params.response),
				checkout.expiresAt,
			],
		);
		return mapPreparation(result.rows[0]);
	}

	async listByUser(userId: string): Promise<PreparedPaymentRecord[]> {
		const result = await this.db.query<PreparationRow>(
			`
				select *
				from payproof_payment_preparations
				where user_id = $1
				order by created_at desc
				limit 50
			`,
			[userId],
		);
		return result.rows.map(mapPreparation);
	}

	async submitTransaction(params: {
		payment: PreparedPaymentRecord;
		submission: PaymentSubmissionRequest;
	}): Promise<PaymentTransactionRecord> {
		const result = await this.db.query<TransactionRow>(
			`
				insert into payproof_payment_transactions (
					id,
					payment_id,
					tx_hash,
					chain_id,
					contract_address,
					from_address,
					to_address,
					status
				)
				values ($1, $2, $3, $4, $5, $6, $7, 'submitted')
				on conflict (tx_hash) do update
				set status = payproof_payment_transactions.status
				returning *
			`,
			[
				randomUUID(),
				params.payment.paymentId,
				params.submission.txHash,
				params.submission.chainId,
				params.submission.contractAddress,
				params.submission.fromAddress,
				params.submission.toAddress,
			],
		);

		await this.db.query(
			`
				update payproof_payment_preparations
				set state = 'submitted', updated_at = now()
				where payment_id = $1 and state <> 'confirmed'
			`,
			[params.payment.paymentId],
		);

		return mapTransaction(result.rows[0]);
	}

	async recordPaymentEvent(params: {
		paymentId: string;
		userId: string;
		eventType: string;
		payload: unknown;
	}): Promise<void> {
		await this.db.query(
			`
				insert into payproof_payment_events (
					id,
					payment_id,
					user_id,
					event_type,
					payload_json
				)
				values ($1, $2, $3, $4, $5)
			`,
			[
				randomUUID(),
				params.paymentId,
				params.userId,
				params.eventType,
				JSON.stringify(params.payload),
			],
		);
	}
}

export function createRequestHash(value: unknown): `0x${string}` {
	return keccak256(toBytes(canonicalJson(value)));
}

function mapPreparation(row: PreparationRow): PreparedPaymentRecord {
	return {
		id: row.id,
		paymentId: row.payment_id,
		userId: row.user_id,
		userWallet: row.user_wallet,
		network: row.network,
		chainId: row.chain_id,
		tokenSymbol: row.token_symbol,
		tokenAddress: row.token_address,
		tokenDecimals: row.token_decimals,
		recipientAddress: row.recipient_address,
		amountBaseUnits: row.amount_base_units,
		amountDisplay: row.amount_display,
		idempotencyKey: row.idempotency_key ?? undefined,
		requestHash: row.request_hash,
		mandateHash: row.mandate_hash ?? undefined,
		contractAddress: row.contract_address ?? undefined,
		policyDecision:
			row.policy_decision as PreparedPaymentRecord["policyDecision"],
		state: row.state,
		response: row.response_json as PreparePaymentResponse,
		expiresAt: toIso(row.expires_at),
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at),
	};
}

function mapTransaction(row: TransactionRow): PaymentTransactionRecord {
	return {
		id: row.id,
		paymentId: row.payment_id,
		txHash: row.tx_hash,
		chainId: row.chain_id,
		contractAddress: row.contract_address,
		fromAddress: row.from_address,
		toAddress: row.to_address,
		status: row.status,
		blockNumber: row.block_number ?? undefined,
		blockHash: row.block_hash ?? undefined,
		confirmations: row.confirmations ?? undefined,
		errorCode: row.error_code ?? undefined,
		errorMessage: row.error_message ?? undefined,
		submittedAt: toIso(row.submitted_at),
		confirmedAt: row.confirmed_at ? toIso(row.confirmed_at) : undefined,
	};
}

function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}
