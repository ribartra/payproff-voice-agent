import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("password hashing", () => {
	test("verifies scrypt hashes and rejects wrong passwords", () => {
		const hash = hashPassword("PayProofDemo2026!");

		expect(verifyPassword("PayProofDemo2026!", hash)).toBe(true);
		expect(verifyPassword("wrong-password", hash)).toBe(false);
	});
});
