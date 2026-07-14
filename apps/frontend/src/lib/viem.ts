import { createPublicClient, custom, http } from "viem";
import { mainnet } from "viem/chains";

type EthereumProvider = Parameters<typeof custom>[0];

const ethereum = (
	globalThis as typeof globalThis & { ethereum?: EthereumProvider }
).ethereum;

const client = createPublicClient({
	chain: mainnet,
	transport: ethereum ? custom(ethereum) : http(),
});
export default client;
