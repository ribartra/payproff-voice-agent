import { createPublicClient, custom } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
	chain: mainnet,
	transport: custom("ethereum" in globalThis ? (globalThis as any).ethereum : undefined),
});
export default client;
