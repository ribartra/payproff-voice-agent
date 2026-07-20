import type {
	PreparedPaymentRecord,
	PreparePaymentRequest,
	PreparePaymentResponse,
} from "@payproof/domain";
import {
	createRequestHash,
	IdempotencyConflictError,
} from "../../repositories/payments.js";

export type PaymentPreparationAgent = {
	prepare(request: PreparePaymentRequest): Promise<PreparePaymentResponse>;
};

export type PaymentPreparationRepository = {
	findByIdempotency(params: {
		userWallet: `0x${string}`;
		idempotencyKey: string;
	}): Promise<PreparedPaymentRecord | null>;
	insertPreparation(params: {
		userId: string;
		request: PreparePaymentRequest;
		requestHash: `0x${string}`;
		response: PreparePaymentResponse;
		tokenDecimals: number;
		contractAddress?: `0x${string}`;
	}): Promise<PreparedPaymentRecord>;
};

export class PaymentPreparationService {
	constructor(
		private readonly repository: PaymentPreparationRepository,
		private readonly agent: PaymentPreparationAgent,
		private readonly config: {
			userId: string;
			tokenDecimals: number;
			contractAddress?: `0x${string}`;
		},
	) {}

	async prepare(
		request: PreparePaymentRequest,
	): Promise<PreparedPaymentRecord> {
		const requestHash = createRequestHash(request);
		if (request.idempotencyKey) {
			const existing = await this.repository.findByIdempotency({
				userWallet: request.userWallet,
				idempotencyKey: request.idempotencyKey,
			});
			if (existing) {
				if (existing.requestHash !== requestHash) {
					throw new IdempotencyConflictError();
				}
				return existing;
			}
		}

		const response = await this.agent.prepare(request);
		return this.repository.insertPreparation({
			userId: this.config.userId,
			request,
			requestHash,
			response,
			tokenDecimals: this.config.tokenDecimals,
			contractAddress: this.config.contractAddress,
		});
	}
}
