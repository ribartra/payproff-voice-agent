import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TEST_USDC =
"0xb7FCC45555A107D8b476AaB70C61A26d48F7B678";

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
