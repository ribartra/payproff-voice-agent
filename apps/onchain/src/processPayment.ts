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
    paymentId: string;
    payer: string;
    payee: string;
    amount: string;
    token: "USDC";
}

const PAYMENT_MANAGER =
    "0x54bEc67D261C167370e69593FFef05c802582371";

const USDC =
    "0xb7FCC45555A107D8b476AaB70C61A26d48F7B678";

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
        transport: http(RPC_URL),
    });


    const amount = parseUnits(
        payment.amount,
        6,
    );


    console.log({
        paymentId: payment.paymentId,
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
            payment.paymentId as `0x${string}`,
            payment.payee as `0x${string}`,
            amount,
        ],
    });


    console.log("Transaction:");
    console.log(hash);


    return hash;
}