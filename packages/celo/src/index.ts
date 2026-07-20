import { codeFromHostname, toDataSuffix } from "@celo/attribution-tags";
import type { Address, Hex } from "viem";
import { celo, celoSepolia } from "viem/chains";

export const CELO_CHAINS = {
	mainnet: {
		chain: celo,
		explorer: "https://celoscan.io",
		id: 42220,
		rpcUrl: "https://forno.celo.org",
	},
	testnet: {
		chain: celoSepolia,
		explorer: "https://celo-sepolia.blockscout.com",
		id: 11142220,
		rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
	},
} as const;

export const CELO_TOKENS = {
	mainnet: {
		USDC: {
			address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" satisfies Address,
			decimals: 6,
		},
		USDm: {
			address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" satisfies Address,
			decimals: 18,
		},
	},
	testnet: {
		USDC: {
			address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E" satisfies Address,
			decimals: 6,
		},
		USDm: {
			address: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" satisfies Address,
			decimals: 18,
		},
	},
} as const;

export function attributionSuffixFromHostname(hostname: string): Hex {
	return toDataSuffix(codeFromHostname(hostname)) as Hex;
}

export function attributionSuffixFromCode(code: string): Hex {
	return toDataSuffix(code) as Hex;
}

export function builderAttributionSuffix(params: {
	assignedCode: string;
	ownCode?: string;
}): Hex {
	const code = params.assignedCode.trim() || params.ownCode?.trim();
	if (!code) {
		throw new Error("A Celo Builders attribution code is required.");
	}
	return attributionSuffixFromCode(code);
}
