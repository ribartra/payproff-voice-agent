import {
	type PreparePaymentRequest,
	type PreparePaymentResponse,
	preparePaymentRequestSchema,
} from "@payproof/domain";
import type { PaymentIntentParser } from "../ai/payment-intent-parser.js";
import {
	createPreparedPayment,
	resolveRecipient,
} from "../mandates/mandates.js";
import { evaluatePaymentPolicy } from "../policy/payment-policy.js";

export class PaymentApplication {
	constructor(private readonly parser: PaymentIntentParser) {}

	async prepare(input: unknown): Promise<PreparePaymentResponse> {
		const request: PreparePaymentRequest =
			preparePaymentRequestSchema.parse(input);
		const parsedIntent = await this.parser.parse(request.transcript);
		const resolvedRecipient = resolveRecipient({
			intent: parsedIntent,
			request,
		});
		const policy = evaluatePaymentPolicy({
			intent: parsedIntent,
			request,
			resolvedRecipient,
		});

		return createPreparedPayment({
			intent: parsedIntent,
			request,
			policy,
			resolvedRecipient,
		});
	}
}
