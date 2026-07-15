import type {
	ParsedPaymentIntent,
	PolicyDecision,
	PreparePaymentRequest,
} from "@payproof/domain";
import { isAddress, parseUnits } from "viem";

const MIN_CONFIDENCE = 0.9;

export function evaluatePaymentPolicy(params: {
	intent: ParsedPaymentIntent;
	request: PreparePaymentRequest;
	resolvedRecipient?: `0x${string}`;
}): PolicyDecision {
	const reasons: string[] = [];
	const { intent, request, resolvedRecipient } = params;

	if (intent.confidence < MIN_CONFIDENCE) {
		reasons.push("Intent confidence is below 0.90.");
	}

	if (!request.allowedTokens.includes(intent.token)) {
		reasons.push(`Token ${intent.token} is not allowed.`);
	}

	if (!resolvedRecipient || !isAddress(resolvedRecipient)) {
		reasons.push("Recipient is unresolved or invalid.");
	}

	if (
		resolvedRecipient &&
		!Object.values(request.merchantAllowlist).includes(resolvedRecipient)
	) {
		reasons.push("Recipient is not in the merchant allowlist.");
	}

	try {
		const decimals = intent.token === "USDC" ? 6 : 18;
		const requested = parseUnits(intent.amount, decimals);
		const max = parseUnits(request.maxAmount, decimals);
		if (requested <= 0n) {
			reasons.push("Amount must be greater than zero.");
		}
		if (requested > max) {
			reasons.push("Amount exceeds the configured maximum.");
		}
	} catch {
		reasons.push("Amount is not parseable.");
	}

	if (!isAddress(request.userWallet)) {
		reasons.push("User wallet is invalid.");
	}

	if (reasons.length === 0) {
		return {
			status: "APPROVED",
			approved: true,
			reasons: ["Policy approved. Human confirmation is still required."],
		};
	}

	const status = reasons.some(
		(reason) => reason.includes("not allowed") || reason.includes("exceeds"),
	)
		? "REJECTED"
		: "REQUIRES_REVIEW";

	return {
		status,
		approved: false,
		reasons,
	};
}
