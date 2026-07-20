import { describe, expect, test } from "bun:test";
import { PaymentAgentTools } from "./payment-tools.js";

const user = {
	id: "user-1",
	displayName: "Demo User",
	email: "demo@payproof.local",
	walletAddress: "0x1111111111111111111111111111111111111111" as const,
	network: "celo-sepolia" as const,
	createdAt: "2026-07-19T00:00:00.000Z",
	updatedAt: "2026-07-19T00:00:00.000Z",
};

const contact = {
	id: "contact-1",
	userId: "user-1",
	alias: "Proveedor",
	walletAddress: "0x2222222222222222222222222222222222222222" as const,
	network: "celo-sepolia" as const,
	preferredToken: "USDC" as const,
	createdAt: "2026-07-19T00:00:00.000Z",
	updatedAt: "2026-07-19T00:00:00.000Z",
};

describe("PaymentAgentTools", () => {
	test("returns user context with AssemblyAI keyterms", async () => {
		const tools = new PaymentAgentTools(
			{
				async findUserById() {
					return user;
				},
				async listContacts() {
					return [contact];
				},
				async getAssemblyAiKeyterms() {
					return {
						keytermsPrompt: ["Proveedor"],
						contacts: [contact],
						maxTerms: 100,
					};
				},
			},
			{
				async findByPaymentId() {
					return null;
				},
			},
		);

		const context = await tools.getUserContext("user-1");

		expect(context.user.id).toBe("user-1");
		expect(context.contacts[0]?.alias).toBe("Proveedor");
		expect(context.keytermsPrompt).toEqual(["Proveedor"]);
	});

	test("resolves contacts by normalized alias", async () => {
		const tools = new PaymentAgentTools(
			{
				async findUserById() {
					return user;
				},
				async listContacts() {
					return [contact];
				},
				async getAssemblyAiKeyterms() {
					return {
						keytermsPrompt: [],
						contacts: [contact],
						maxTerms: 100,
					};
				},
			},
			{
				async findByPaymentId() {
					return null;
				},
			},
		);

		const resolved = await tools.resolveContact({
			userId: "user-1",
			alias: " proveedor ",
		});

		expect(resolved?.walletAddress).toBe(contact.walletAddress);
	});
});
