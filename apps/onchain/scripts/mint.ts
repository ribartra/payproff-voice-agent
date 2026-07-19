import { network } from "hardhat";


const TOKEN =
    "0xb7FCC45555A107D8b476AaB70C61A26d48F7B678";


const amount = 5_000_000n;


const { viem } = await network.connect({
    network: "celoSepolia",
});


const [wallet] = await viem.getWalletClients();


const tx = await wallet.writeContract({
    address: TOKEN as `0x${string}`,
    abi: [
        {
            type: "function",
            name: "mint",
            stateMutability: "nonpayable",
            inputs: [
                {
                    name: "to",
                    type: "address",
                },
                {
                    name: "amount",
                    type: "uint256",
                },
            ],
            outputs: [],
        },
    ],
    functionName: "mint",
    args: [
        wallet.account.address,
        amount,
    ],
});


console.log("Mint tx:");
console.log(tx);