import { network } from "hardhat";
import { parseUnits, keccak256, toBytes } from "viem";

const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const PAYMENT_MANAGER =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

async function main() {
    const { viem } = await network.connect();

    const [payer, receiver] = await viem.getWalletClients();

    const token = await viem.getContractAt(
        "TestErc20",
        TOKEN
    );

    const manager = await viem.getContractAt(
        "PaymentManager",
        PAYMENT_MANAGER
    );

    const managerToken = await manager.read.usdc();

    console.log("PaymentManager USDC:", managerToken);
    console.log("Token usado:", TOKEN);

    const amount = parseUnits("5", 6);

    console.log("payer:", payer.account.address);
    console.log("receiver:", receiver.account.address);

    await token.write.mint([
        payer.account.address,
        amount
    ], {
        account: payer.account
    });

    console.log("USDC creado");

    await token.write.approve([
        PAYMENT_MANAGER,
        amount
    ], {
        account: payer.account
    });

    console.log("approve listo");

    const paymentId = keccak256(
        toBytes("payment-demo-1")
    );

    console.log("paymentId:", paymentId);

    await manager.write.pay([
        paymentId,
        receiver.account.address as `0x${string}`,
        amount
    ], {
        account: payer.account
    });

    console.log("payment ejecutado");

    try {
        await manager.write.pay([
            paymentId,
            receiver.account.address as `0x${string}`,
            amount
        ], {
            account: payer.account
        });

        console.log("ERROR: permitió pago duplicado");
    } catch (error) {
        console.log("Pago duplicado rechazado correctamente");
    }

    const balance = await token.read.balanceOf([
        receiver.account.address
    ]);

    console.log(
        "saldo receptor:",
        balance.toString()
    );
}

main();