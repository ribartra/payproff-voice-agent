import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CELO_SEPOLIA_USDC = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";

const PaymentManagerModule = buildModule("PaymentManagerModule", (m) => {
	const usdcAddress = m.getParameter("usdcAddress", CELO_SEPOLIA_USDC);
	const paymentManager = m.contract("PaymentManager", [[usdcAddress]]);

	return {
		paymentManager,
	};
});

export default PaymentManagerModule;
