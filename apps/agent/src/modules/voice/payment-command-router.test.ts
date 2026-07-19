import { describe, expect, test } from "bun:test";
import { PaymentCommandRouter } from "./payment-command-router.js";

describe("PaymentCommandRouter", () => {
	const router = new PaymentCommandRouter();

	test("detects a payment command with amount and token", () => {
		const result = router.route(
			"Quiero pagar 0.5 USDC al proveedor por la factura demo",
		);

		expect(result.intent).toBe("payment");
		expect(result.isCommand).toBe(true);
		expect(result.entities.amount).toBe("0.5");
		expect(result.entities.token).toBe("USDC");
		expect(result.entities.recipientAlias).toBe("proveedor");
		expect(result.confidence).toBeGreaterThanOrEqual(0.9);
	});

	test("marks unrelated text as unknown", () => {
		const result = router.route("Hola, solo quiero ver el estado general");

		expect(result.intent).toBe("unknown");
		expect(result.isCommand).toBe(false);
		expect(result.confidence).toBe(0);
	});
});
