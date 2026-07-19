import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";

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
			token.address,
		]);
		const amount = parseUnits("0.5", 6);

		await token.write.mint([payer.account.address, amount], {
			account: payer.account,
		});
		await token.write.approve([paymentManager.address, amount], {
			account: payer.account,
		});
		const deploymentBlockNumber = await publicClient.getBlockNumber();

		await paymentManager.write.pay([payee.account.address, amount], {
			account: payer.account,
		});
		const events = await publicClient.getContractEvents({
			address: paymentManager.address,
			abi: paymentManager.abi,
			eventName: "PaymentExecuted",
			fromBlock: deploymentBlockNumber,
			strict: true,
		});

		assert.equal(events.length, 1);
		assert.equal(await token.read.balanceOf([payee.account.address]), amount);
	});
});
