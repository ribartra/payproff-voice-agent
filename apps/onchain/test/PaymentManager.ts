import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, zeroAddress } from "viem";

describe("PaymentManager", async function () {
	const { viem } = await network.connect();
	const publicClient = await viem.getPublicClient();
	const [payer, payee] = await viem.getWalletClients();

	it("executes an approved USDC transfer and emits PaymentExecuted", async function () {
		const token = await viem.deployContract("TestErc20", [
			"USD Coin",
			"USDC",
			6,
		]);
		const paymentManager = await viem.deployContract("PaymentManager", [
			[token.address],
		]);
		const amount = parseUnits("0.5", 6);
		const paymentId =
			"0x1111111111111111111111111111111111111111111111111111111111111111";
		const mandateHash =
			"0x2222222222222222222222222222222222222222222222222222222222222222";

		await token.write.mint([payer.account.address, amount], {
			account: payer.account,
		});
		await token.write.approve([paymentManager.address, amount], {
			account: payer.account,
		});
		const deploymentBlockNumber = await publicClient.getBlockNumber();

		await paymentManager.write.pay(
			[
				paymentId,
				mandateHash,
				token.address,
				payee.account.address,
				amount,
			],
			{
				account: payer.account,
			},
		);
		const events = await publicClient.getContractEvents({
			address: paymentManager.address,
			abi: paymentManager.abi,
			eventName: "PaymentExecuted",
			fromBlock: deploymentBlockNumber,
			strict: true,
		});

		assert.equal(events.length, 1);
		assert.equal(events[0].args.paymentId, paymentId);
		assert.equal(events[0].args.mandateHash, mandateHash);
		assert.equal(
			events[0].args.payer?.toLowerCase(),
			payer.account.address.toLowerCase(),
		);
		assert.equal(
			events[0].args.token?.toLowerCase(),
			token.address.toLowerCase(),
		);
		assert.equal(
			events[0].args.recipient?.toLowerCase(),
			payee.account.address.toLowerCase(),
		);
		assert.equal(events[0].args.amount, amount);
		assert.equal(await token.read.balanceOf([payee.account.address]), amount);
	});

	it("rejects duplicate payment ids", async function () {
		const token = await viem.deployContract("TestErc20", [
			"USD Coin",
			"USDC",
			6,
		]);
		const paymentManager = await viem.deployContract("PaymentManager", [
			[token.address],
		]);
		const amount = parseUnits("0.5", 6);
		const paymentId =
			"0x3333333333333333333333333333333333333333333333333333333333333333";
		const mandateHash =
			"0x4444444444444444444444444444444444444444444444444444444444444444";

		await token.write.mint([payer.account.address, amount * 2n], {
			account: payer.account,
		});
		await token.write.approve([paymentManager.address, amount * 2n], {
			account: payer.account,
		});
		await paymentManager.write.pay(
			[paymentId, mandateHash, token.address, payee.account.address, amount],
			{ account: payer.account },
		);

		await assert.rejects(
			paymentManager.write.pay(
				[paymentId, mandateHash, token.address, payee.account.address, amount],
				{ account: payer.account },
			),
		);
	});

	it("rejects zero recipient, zero amount and non-allowed token", async function () {
		const token = await viem.deployContract("TestErc20", [
			"USD Coin",
			"USDC",
			6,
		]);
		const otherToken = await viem.deployContract("TestErc20", [
			"Other",
			"OTR",
			6,
		]);
		const paymentManager = await viem.deployContract("PaymentManager", [
			[token.address],
		]);
		const amount = parseUnits("0.5", 6);
		const paymentId =
			"0x5555555555555555555555555555555555555555555555555555555555555555";
		const mandateHash =
			"0x6666666666666666666666666666666666666666666666666666666666666666";

		await assert.rejects(
			paymentManager.write.pay(
				[paymentId, mandateHash, token.address, zeroAddress, amount],
				{ account: payer.account },
			),
		);
		await assert.rejects(
			paymentManager.write.pay(
				[paymentId, mandateHash, token.address, payee.account.address, 0n],
				{ account: payer.account },
			),
		);
		await assert.rejects(
			paymentManager.write.pay(
				[
					paymentId,
					mandateHash,
					otherToken.address,
					payee.account.address,
					amount,
				],
				{ account: payer.account },
			),
		);
	});
});
