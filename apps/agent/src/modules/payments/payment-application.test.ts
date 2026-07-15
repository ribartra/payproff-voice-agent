import { describe, expect, test } from "bun:test";
import { PaymentIntentParser } from "../ai/payment-intent-parser.js";
import { PaymentApplication } from "./payment-application.js";

const userWallet = "0x1111111111111111111111111111111111111111";
const providerWallet = "0x2222222222222222222222222222222222222222";

function createApplication() {
	return new PaymentApplication(
		new PaymentIntentParser({
			model: "gemini-2.5-flash",
		}),
	);
}

describe("PaymentApplication", () => {
	test("prepares an approved payment mandate from a voice transcript", async () => {
		const payment = await createApplication().prepare({
			transcript: "Paga 5 USDC al proveedor por la factura",
			userWallet,
			merchantAllowlist: {
				proveedor: providerWallet,
			},
			maxAmount: "10",
			idempotencyKey: "invoice-1",
		});

		expect(payment.state).toBe("awaiting_confirmation");
		expect(payment.policy.status).toBe("APPROVED");
		expect(payment.policy.mandateHash).toMatch(/^0x[a-f0-9]{64}$/);
		expect(payment.checkoutMandate?.merchant).toBe(providerWallet);
		expect(payment.paymentMandate?.payer).toBe(userWallet);
		expect(payment.paymentMandate?.payee).toBe(providerWallet);
		expect(payment.paymentMandate?.amountBaseUnits).toBe("5000000");
	});

	test("requires review when the recipient is not resolved", async () => {
		const payment = await createApplication().prepare({
			transcript: "Paga 2 USDC a desconocido por soporte",
			userWallet,
			merchantAllowlist: {},
			maxAmount: "10",
		});

		expect(payment.state).toBe("ambiguous");
		expect(payment.policy.status).toBe("REQUIRES_REVIEW");
		expect(payment.checkoutMandate).toBeUndefined();
		expect(payment.policy.reasons).toContain(
			"Recipient is unresolved or invalid.",
		);
	});

	test("rejects payments above the configured maximum", async () => {
		const payment = await createApplication().prepare({
			transcript: "Paga 15 USDC al proveedor por la factura",
			userWallet,
			merchantAllowlist: {
				proveedor: providerWallet,
			},
			maxAmount: "10",
		});

		expect(payment.state).toBe("rejected");
		expect(payment.policy.status).toBe("REJECTED");
		expect(payment.paymentMandate).toBeUndefined();
		expect(payment.policy.reasons).toContain(
			"Amount exceeds the configured maximum.",
		);
	});
});
