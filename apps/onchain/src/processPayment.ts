import "dotenv/config";
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoSepolia } from "viem/chains";
import { paymentManagerAbi } from "./paymentManagerAbi.js";
import { erc20Abi } from "./erc20Abi.js";

export interface PaymentRequest {
    payer: string;
    payee: string;
    amount: string;
    token: "USDC";
}

const PAYMENT_MANAGER =
    "0x7044F3945D17B9C14102F13E8fb16b492bDDcFB7";

const USDC =
    "0x01C5C0122039549AD1493B8220cABEdD739BC44E";  

const PRIVATE_KEY =
    process.env.CELO_SEPOLIA_PRIVATE_KEY as `0x${string}`;

const RPC_URL =
    process.env.CELO_SEPOLIA_RPC_URL;


export async function processPayment(
    payment: PaymentRequest,
) {

    console.log("Processing payment...");

    const account = privateKeyToAccount(PRIVATE_KEY);

    console.log("Wallet usada:");
    console.log(account.address);


    const walletClient = createWalletClient({
        account,
        chain: celoSepolia,
        transport: http(RPC_URL),
    });


    const publicClient = createPublicClient({
        chain: celoSepolia,
        transport: http(
            process.env.CELO_SEPOLIA_RPC_URL,
        ),
    });

    const amount = parseUnits(
        payment.amount,
        6,
    );


    console.log({
        from: account.address,
        to: payment.payee,
        amount: amount.toString(),
    });
    const balance = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [
            account.address,
        ],
    });

    console.log("USDC Balance:");
    console.log(balance.toString());

    console.log("Approving USDC...");


    const approveHash = await walletClient.writeContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [
            PAYMENT_MANAGER,
            amount,
        ],
    });


    await publicClient.waitForTransactionReceipt({
        hash: approveHash,
    });


    console.log("Approve confirmado");
    console.log(approveHash);


    const allowance = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "allowance",
        args: [
            account.address,
            PAYMENT_MANAGER,
        ],
    });


    console.log("Allowance:");
    console.log(allowance.toString());


    console.log("Sending payment...");


    const hash = await walletClient.writeContract({
        address: PAYMENT_MANAGER,
        abi: paymentManagerAbi,
        functionName: "pay",
        args: [
            payment.payee as `0x${string}`,
            amount,
        ],
    });


    console.log("Transaction:");
    console.log(hash);
}