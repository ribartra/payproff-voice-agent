import type { ChainEventRecord } from "@payproof/domain";
import type { Address, Hex, Log } from "viem";
import {
	decodePaymentExecutedLog,
	paymentExecutedEventAbi,
} from "./payment-manager.js";

export type ChainIndexerCursor = {
	chainId: number;
	contractAddress: Address;
	lastScannedBlock: bigint;
	lastScannedBlockHash: Hex;
};

export type ChainEventRepository = {
	upsertPaymentExecuted(
		event: Omit<ChainEventRecord, "id">,
	): Promise<ChainEventRecord>;
	markPaymentConfirmed(
		paymentId: Hex,
		chainEvent: ChainEventRecord,
	): Promise<void>;
};

export type ChainCursorRepository = {
	getCursor(params: {
		chainId: number;
		contractAddress: Address;
	}): Promise<ChainIndexerCursor | null>;
	saveCursor(cursor: ChainIndexerCursor): Promise<void>;
};

export type ChainPublicClient = {
	getBlockNumber(): Promise<bigint>;
	getBlock(params: { blockNumber: bigint }): Promise<{ hash: Hex | null }>;
	getLogs(params: {
		address: Address;
		event: typeof paymentExecutedEventAbi;
		fromBlock: bigint;
		toBlock: bigint;
	}): Promise<Log[]>;
};

export class ChainIndexer {
	constructor(
		private readonly config: {
			chainId: number;
			contractAddress: Address;
			startBlock: bigint;
			confirmationsRequired: bigint;
			reorgLookbackBlocks: bigint;
		},
		private readonly client: ChainPublicClient,
		private readonly events: ChainEventRepository,
		private readonly cursors: ChainCursorRepository,
	) {}

	async backfillOnce(): Promise<{
		fromBlock: bigint;
		toBlock: bigint;
		processedLogs: number;
	}> {
		const latestBlock = await this.client.getBlockNumber();
		const safeBlock = latestBlock - this.config.confirmationsRequired;
		if (safeBlock < this.config.startBlock) {
			return {
				fromBlock: this.config.startBlock,
				toBlock: this.config.startBlock - 1n,
				processedLogs: 0,
			};
		}

		const cursor = await this.cursors.getCursor({
			chainId: this.config.chainId,
			contractAddress: this.config.contractAddress,
		});
		const nextBlock = cursor
			? cursor.lastScannedBlock - this.config.reorgLookbackBlocks + 1n
			: this.config.startBlock;
		const fromBlock =
			nextBlock > this.config.startBlock ? nextBlock : this.config.startBlock;
		const logs = await this.client.getLogs({
			address: this.config.contractAddress,
			event: paymentExecutedEventAbi,
			fromBlock,
			toBlock: safeBlock,
		});

		for (const log of logs) {
			await this.ingestLog(log);
		}

		const block = await this.client.getBlock({ blockNumber: safeBlock });
		if (!block.hash) {
			throw new Error("Safe block has no hash.");
		}
		await this.cursors.saveCursor({
			chainId: this.config.chainId,
			contractAddress: this.config.contractAddress,
			lastScannedBlock: safeBlock,
			lastScannedBlockHash: block.hash,
		});

		return {
			fromBlock,
			toBlock: safeBlock,
			processedLogs: logs.length,
		};
	}

	async ingestLog(log: Log): Promise<ChainEventRecord> {
		const decoded = decodePaymentExecutedLog({
			chainId: this.config.chainId,
			contractAddress: this.config.contractAddress,
			log,
		});
		const record = await this.events.upsertPaymentExecuted({
			chainId: decoded.chainId,
			contractAddress: decoded.contractAddress,
			txHash: decoded.txHash,
			logIndex: decoded.logIndex,
			blockNumber: decoded.blockNumber.toString(),
			blockHash: decoded.blockHash,
			eventName: "PaymentExecuted",
			paymentId: decoded.paymentId,
			mandateHash: decoded.mandateHash,
			payer: decoded.payer,
			tokenAddress: decoded.tokenAddress,
			recipientAddress: decoded.recipientAddress,
			amountBaseUnits: decoded.amountBaseUnits,
			removed: decoded.removed,
			observedAt: new Date().toISOString(),
			confirmedAt: decoded.removed ? undefined : new Date().toISOString(),
		});

		if (!decoded.removed) {
			await this.events.markPaymentConfirmed(decoded.paymentId, record);
		}

		return record;
	}
}
