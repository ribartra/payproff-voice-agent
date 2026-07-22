import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TEST_USDC =
        "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const PaymentManagerModule = buildModule("PaymentManagerModule", (m) => {
<<<<<<< HEAD
	const usdcAddress = m.getParameter("usdcAddress", CELO_SEPOLIA_USDC);
	const paymentManager = m.contract("PaymentManager", [[usdcAddress]]);
=======
	const usdcAddress = m.getParameter("usdcAddress", TEST_USDC);
	const paymentManager = m.contract("PaymentManager", [usdcAddress]);
>>>>>>> 878f573 (onchain check)

	return {
		paymentManager,
	};
});

export default PaymentManagerModule;
