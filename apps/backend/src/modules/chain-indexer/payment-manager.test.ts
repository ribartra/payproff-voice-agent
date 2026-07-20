import { describe, expect, test } from "bun:test";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import {
	decodePaymentExecutedLog,
	paymentExecutedEventAbi,
} from "./payment-manager.js";

describe("decodePaymentExecutedLog", () => {
	test("decodes PaymentExecuted logs into base-unit records", () => {
		const paymentId =
			"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
		const mandateHash =
			"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
		const payer = "0x1111111111111111111111111111111111111111";
		const token = "0x2222222222222222222222222222222222222222";
		const recipient = "0x3333333333333333333333333333333333333333";
		const topics = encodeEventTopics({
			abi: [paymentExecutedEventAbi],
			eventName: "PaymentExecuted",
			args: {
				paymentId,
				mandateHash,
				payer,
			},
		});
		const data = encodeAbiParameters(
			[
				{ name: "token", type: "address" },
				{ name: "recipient", type: "address" },
				{ name: "amount", type: "uint256" },
			],
			[token, recipient, 500000n],
		);

		const decoded = decodePaymentExecutedLog({
			chainId: 11142220,
			contractAddress: "0x4444444444444444444444444444444444444444",
			log: {
				address: "0x4444444444444444444444444444444444444444",
				blockHash:
					"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
				blockNumber: 123n,
				data,
				logIndex: 7,
				removed: false,
				topics,
				transactionHash:
					"0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
			},
		});

		expect(decoded.paymentId).toBe(paymentId);
		expect(decoded.mandateHash).toBe(mandateHash);
		expect(decoded.payer).toBe(payer);
		expect(decoded.tokenAddress).toBe(token);
		expect(decoded.recipientAddress).toBe(recipient);
		expect(decoded.amountBaseUnits).toBe("500000");
		expect(decoded.blockNumber).toBe(123n);
		expect(decoded.logIndex).toBe(7);
	});
});
