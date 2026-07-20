import { describe, expect, test } from "bun:test";
import type { ChainEventRecord } from "@payproof/domain";
import {
	encodeAbiParameters,
	encodeEventTopics,
	type Hex,
	type Log,
} from "viem";
import { ChainIndexer, type ChainIndexerCursor } from "./indexer.js";
import { paymentExecutedEventAbi } from "./payment-manager.js";

const contractAddress = "0x4444444444444444444444444444444444444444";
const blockHash =
	"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

describe("ChainIndexer", () => {
	test("backfills safe PaymentExecuted logs and saves a cursor", async () => {
		const log = createPaymentExecutedLog();
		const stored: ChainEventRecord[] = [];
		let cursor: ChainIndexerCursor | null = null;
		const indexer = new ChainIndexer(
			{
				chainId: 11142220,
				contractAddress,
				startBlock: 100n,
				confirmationsRequired: 2n,
				reorgLookbackBlocks: 5n,
			},
			{
				async getBlockNumber() {
					return 125n;
				},
				async getBlock({ blockNumber }) {
					return { hash: blockNumber === 123n ? blockHash : null };
				},
				async getLogs(params) {
					expect(params.fromBlock).toBe(100n);
					expect(params.toBlock).toBe(123n);
					return [log];
				},
			},
			{
				async upsertPaymentExecuted(event) {
					const record: ChainEventRecord = {
						id: "chain-event-1",
						...event,
					};
					stored.push(record);
					return record;
				},
				async markPaymentConfirmed(paymentId) {
					expect(paymentId).toBe(stored[0]?.paymentId);
				},
			},
			{
				async getCursor() {
					return cursor;
				},
				async saveCursor(nextCursor) {
					cursor = nextCursor;
				},
			},
		);

		const result = await indexer.backfillOnce();

		expect(result.processedLogs).toBe(1);
		expect(stored[0]?.amountBaseUnits).toBe("500000");
		expect(cursor?.lastScannedBlock).toBe(123n);
		expect(cursor?.lastScannedBlockHash).toBe(blockHash);
	});
});

function createPaymentExecutedLog(): Log {
	const topics = encodeEventTopics({
		abi: [paymentExecutedEventAbi],
		eventName: "PaymentExecuted",
		args: {
			paymentId:
				"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			mandateHash:
				"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			payer: "0x1111111111111111111111111111111111111111",
		},
	});
	const data = encodeAbiParameters(
		[
			{ name: "token", type: "address" },
			{ name: "recipient", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		[
			"0x2222222222222222222222222222222222222222",
			"0x3333333333333333333333333333333333333333",
			500000n,
		],
	);

	return {
		address: contractAddress,
		blockHash,
		blockNumber: 123n,
		data,
		logIndex: 1,
		removed: false,
		topics,
		transactionHash:
			"0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as Hex,
	};
}
