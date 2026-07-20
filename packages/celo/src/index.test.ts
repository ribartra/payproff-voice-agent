import { describe, expect, test } from "bun:test";
import {
	attributionSuffixFromCode,
	builderAttributionSuffix,
} from "./index.js";

describe("Celo attribution helpers", () => {
	test("builds calldata suffixes from explicit codes", () => {
		expect(attributionSuffixFromCode("celo_payproof")).toMatch(/^0x[0-9a-f]+$/);
	});

	test("prefers the assigned Celo Builders code over an own fallback", () => {
		expect(
			builderAttributionSuffix({
				assignedCode: "celo_assigned",
				ownCode: "payproof_local",
			}),
		).toBe(attributionSuffixFromCode("celo_assigned"));
	});

	test("uses own code only as a local fallback", () => {
		expect(
			builderAttributionSuffix({
				assignedCode: " ",
				ownCode: "payproof_local",
			}),
		).toBe(attributionSuffixFromCode("payproof_local"));
	});
});
