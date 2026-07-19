import { createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { erc20Abi } from "../src/erc20Abi.js";

const client = createPublicClient({
    chain: celoSepolia,
    transport: http(
        process.env.CELO_SEPOLIA_RPC_URL
    ),
});

const TOKEN =
"0x01C5C0122039549AD1493B8220cABEdD739BC44E";

const wallet1 =
"0x4b019d79623413FFb4C0Dc29f247c1663D41Ee2d";

const wallet2 =
"0x9326b707d83A4A299f255fbC9262618d294c9457";


const balance1 = await client.readContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args:[wallet1],
});


const balance2 = await client.readContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args:[wallet2],
});


console.log("Wallet origen:");
console.log(balance1.toString());

console.log("Wallet destino:");
console.log(balance2.toString());