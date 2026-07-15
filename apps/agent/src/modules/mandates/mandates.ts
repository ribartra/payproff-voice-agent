import { createHash } from "node:crypto";
import { CELO_CHAINS, CELO_TOKENS } from "@payproof/celo";
import type {
	CheckoutMandate,
	IntentMandate,
	ParsedPaymentIntent,
	PaymentMandate,
	PolicyDecision,
	PreparePaymentRequest,
	PreparePaymentResponse,
} from "@payproof/domain";
import { keccak256, parseUnits, toBytes } from "viem";

export function resolveRecipient(params: {
	intent: ParsedPaymentIntent;
	request: PreparePaymentRequest;
}): `0x${string}` | undefined {
	return (
		params.intent.recipientAddress ??
		params.request.merchantAllowlist[params.intent.recipientAlias] ??
		params.request.merchantAllowlist[params.intent.recipientAlias.toLowerCase()]
	);
}

export function createPreparedPayment(params: {
	intent: ParsedPaymentIntent;
	request: PreparePaymentRequest;
	policy: PolicyDecision;
	resolvedRecipient?: `0x${string}`;
}): PreparePaymentResponse {
	const now = new Date();
	const expiresAt = new Date(
		now.getTime() + params.request.validMinutes * 60_000,
	);
	const paymentId = createPaymentId({
		payer: params.request.userWallet,
		invoiceHash: params.request.invoiceHash ?? params.request.transcript,
		recipient: params.resolvedRecipient ?? params.intent.recipientAlias,
		token: params.intent.token,
		amount: params.intent.amount,
		expiration: expiresAt.toISOString(),
		idempotencyKey: params.request.idempotencyKey,
	});

	if (!params.policy.approved || !params.resolvedRecipient) {
		return {
			paymentId,
			state: params.policy.status === "REJECTED" ? "rejected" : "ambiguous",
			intent: params.intent,
			policy: params.policy,
			confirmationPrompt: buildConfirmationPrompt(params.intent, params.policy),
		};
	}

	const intentMandate: IntentMandate = {
		id: `intent_${paymentId}`,
		userWallet: params.request.userWallet,
		instruction: params.request.transcript,
		allowedTokens: params.request.allowedTokens,
		merchantAllowlist: Object.values(params.request.merchantAllowlist),
		maxAmount: params.request.maxAmount,
		validUntil: expiresAt.toISOString(),
		createdAt: now.toISOString(),
	};

	const checkoutMandate: CheckoutMandate = {
		id: `checkout_${paymentId}`,
		intentMandateId: intentMandate.id,
		merchant: params.resolvedRecipient,
		description: params.intent.reason,
		amount: params.intent.amount,
		token: params.intent.token,
		network: params.request.network,
		expiresAt: expiresAt.toISOString(),
		evidenceHash: params.request.invoiceHash,
	};

	const token =
		CELO_TOKENS[params.request.network === "celo" ? "mainnet" : "testnet"][
			params.intent.token
		];
	const chain =
		CELO_CHAINS[params.request.network === "celo" ? "mainnet" : "testnet"];
	const amountBaseUnits = parseUnits(
		params.intent.amount,
		token.decimals,
	).toString();

	const paymentMandate: PaymentMandate = {
		id: `payment_${paymentId}`,
		checkoutMandateId: checkoutMandate.id,
		payer: params.request.userWallet,
		payee: params.resolvedRecipient,
		tokenAddress: token.address,
		amountBaseUnits,
		chainId: chain.id,
		authorizationType: "WALLET_TRANSACTION",
	};

	const mandateHash = hashMandate({
		intentMandate,
		checkoutMandate,
		paymentMandate,
	});

	return {
		paymentId,
		state: "awaiting_confirmation",
		intent: params.intent,
		policy: {
			...params.policy,
			mandateHash,
		},
		intentMandate,
		checkoutMandate,
		paymentMandate,
		confirmationPrompt: buildConfirmationPrompt(params.intent, params.policy),
	};
}

export function hashMandate(value: unknown): `0x${string}` {
	return keccak256(toBytes(canonicalJson(value)));
}

function createPaymentId(params: {
	payer: string;
	invoiceHash: string;
	recipient: string;
	token: string;
	amount: string;
	expiration: string;
	idempotencyKey?: string;
}): string {
	const source = [
		params.payer,
		params.invoiceHash,
		params.recipient,
		params.token,
		params.amount,
		params.expiration,
		params.idempotencyKey ?? "",
	].join("|");
	return createHash("sha256").update(source).digest("hex");
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function buildConfirmationPrompt(
	intent: ParsedPaymentIntent,
	policy: PolicyDecision,
): string {
	if (!policy.approved) {
		return `No puedo preparar este pago todavía: ${policy.reasons.join(" ")}`;
	}
	return `Entendí ${intent.amount} ${intent.token} para ${intent.recipientAlias}. ¿Confirmas este pago?`;
}
