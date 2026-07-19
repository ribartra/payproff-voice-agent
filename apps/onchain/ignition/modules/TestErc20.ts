import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TestErc20Module = buildModule(
    "TestErc20Module",
    (m) => {

        const token = m.contract(
            "TestErc20",
            [
                "Test USDC",
                "USDC",
                6
            ]
        );

        return {
            token,
        };
    }
);

export default TestErc20Module;