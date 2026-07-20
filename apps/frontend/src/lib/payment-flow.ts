export type BackendContact = {
	id: string;
	userId: string;
	alias: string;
	walletAddress: `0x${string}`;
	network: "celo-sepolia" | "celo";
	preferredToken: "USDC" | "USDm";
};

export type RequestPayload = {
	transcript: string;
	userWallet: `0x${string}`;
	network: "celo-sepolia";
	allowedTokens: string[];
	merchantAllowlist: Record<string, `0x${string}`>;
	maxAmount: string;
	validMinutes: number;
	idempotencyKey: string;
};

export type RealtimeEnvelope = {
	eventId: string;
	type: string;
	version: 1;
	occurredAt: string;
	userId: string;
	aggregateId: string;
	payload: unknown;
};

export function buildPaymentRequestPayload(params: {
	transcript: string;
	userWallet: `0x${string}`;
	merchantAlias: string;
	merchantAddress: `0x${string}`;
	maxAmount: string;
	idempotencyKey: string;
	contacts: BackendContact[];
}): RequestPayload {
	const contactAllowlist = Object.fromEntries(
		params.contacts.map((contact) => [contact.alias, contact.walletAddress]),
	);

	return {
		transcript: params.transcript,
		userWallet: params.userWallet,
		network: "celo-sepolia",
		allowedTokens: ["USDC", "USDm"],
		merchantAllowlist: {
			...contactAllowlist,
			[params.merchantAlias]: params.merchantAddress,
		},
		maxAmount: params.maxAmount,
		validMinutes: 15,
		idempotencyKey: params.idempotencyKey,
	};
}

export function shouldRefreshSnapshotFromEvent(
	event: RealtimeEnvelope,
): "contacts" | "payments" | "session" | null {
	if (event.version !== 1) {
		return "session";
	}
	if (
		event.type.startsWith("contact.") ||
		event.type === "contacts.snapshot_invalidated"
	) {
		return "contacts";
	}
	if (event.type.startsWith("payment.")) {
		return "payments";
	}
	if (event.type === "session.expired") {
		return "session";
	}
	return null;
}
