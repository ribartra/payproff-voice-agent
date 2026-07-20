import { createConfig, http } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
	chains: [celoSepolia, celo],
	connectors: [injected()],
	transports: {
		[celoSepolia.id]: http(),
		[celo.id]: http(),
	},
});
