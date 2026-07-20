import type { PreparedPaymentRecord } from "@payproof/domain";
import type { PayproofContact, PayproofUser } from "../../schemas.js";

export type UserContextRepository = {
	findUserById(userId: string): Promise<PayproofUser | null>;
	listContacts(userId: string): Promise<PayproofContact[]>;
	getAssemblyAiKeyterms(userId: string): Promise<{
		keytermsPrompt: string[];
		contacts: PayproofContact[];
		maxTerms: number;
	}>;
};

export type PaymentStatusRepository = {
	findByPaymentId(paymentId: string): Promise<PreparedPaymentRecord | null>;
};

export class PaymentAgentTools {
	constructor(
		private readonly users: UserContextRepository,
		private readonly payments: PaymentStatusRepository,
	) {}

	async getUserContext(userId: string): Promise<{
		user: PayproofUser;
		contacts: PayproofContact[];
		keytermsPrompt: string[];
	}> {
		const user = await this.users.findUserById(userId);
		if (!user) {
			throw new Error("USER_NOT_FOUND");
		}
		const [contacts, keyterms] = await Promise.all([
			this.users.listContacts(userId),
			this.users.getAssemblyAiKeyterms(userId),
		]);

		return {
			user,
			contacts,
			keytermsPrompt: keyterms.keytermsPrompt,
		};
	}

	async resolveContact(params: {
		userId: string;
		alias: string;
	}): Promise<PayproofContact | null> {
		const contacts = await this.users.listContacts(params.userId);
		const normalizedAlias = normalizeAlias(params.alias);
		return (
			contacts.find(
				(contact) => normalizeAlias(contact.alias) === normalizedAlias,
			) ?? null
		);
	}

	async getPaymentStatus(paymentId: string): Promise<{
		paymentId: string;
		state: PreparedPaymentRecord["state"];
		txHash?: string;
		amountBaseUnits: string;
		recipientAddress: `0x${string}`;
	} | null> {
		const payment = await this.payments.findByPaymentId(paymentId);
		if (!payment) {
			return null;
		}

		return {
			paymentId: payment.paymentId,
			state: payment.state,
			amountBaseUnits: payment.amountBaseUnits,
			recipientAddress: payment.recipientAddress,
		};
	}
}

function normalizeAlias(alias: string): string {
	return alias.trim().toLowerCase();
}
