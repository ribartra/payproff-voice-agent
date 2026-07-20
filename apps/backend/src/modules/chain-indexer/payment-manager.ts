import {
	type Address,
	decodeEventLog,
	type Hex,
	type Log,
	parseAbiItem,
} from "viem";

export const paymentExecutedEventAbi = parseAbiItem(
	"event PaymentExecuted(bytes32 indexed paymentId, bytes32 indexed mandateHash, address indexed payer, address token, address recipient, uint256 amount)",
);

export type PaymentExecutedLog = {
	chainId: number;
	contractAddress: Address;
	txHash: Hex;
	logIndex: number;
	blockNumber: bigint;
	blockHash: Hex;
	paymentId: Hex;
	mandateHash: Hex;
	payer: Address;
	tokenAddress: Address;
	recipientAddress: Address;
	amountBaseUnits: string;
	removed: boolean;
};

export function decodePaymentExecutedLog(params: {
	chainId: number;
	contractAddress: Address;
	log: Pick<
		Log,
		| "address"
		| "blockHash"
		| "blockNumber"
		| "data"
		| "logIndex"
		| "removed"
		| "topics"
		| "transactionHash"
	>;
}): PaymentExecutedLog {
	const decoded = decodeEventLog({
		abi: [paymentExecutedEventAbi],
		data: params.log.data,
		topics: params.log.topics,
	});

	if (decoded.eventName !== "PaymentExecuted") {
		throw new Error(`Unsupported event: ${decoded.eventName}`);
	}
	if (
		!params.log.blockHash ||
		params.log.blockNumber === null ||
		params.log.logIndex === null ||
		!params.log.transactionHash
	) {
		throw new Error("PaymentExecuted log is missing mined log metadata.");
	}

	return {
		chainId: params.chainId,
		contractAddress: params.contractAddress,
		txHash: params.log.transactionHash,
		logIndex: params.log.logIndex,
		blockNumber: params.log.blockNumber,
		blockHash: params.log.blockHash,
		paymentId: decoded.args.paymentId,
		mandateHash: decoded.args.mandateHash,
		payer: decoded.args.payer,
		tokenAddress: decoded.args.token,
		recipientAddress: decoded.args.recipient,
		amountBaseUnits: decoded.args.amount.toString(),
		removed: Boolean(params.log.removed),
	};
}
