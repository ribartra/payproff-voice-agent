import { describe, expect, test } from "bun:test";
import { buildAssemblyAiKeyterms } from "./keyterms.js";

describe("buildAssemblyAiKeyterms", () => {
	test("deduplicates aliases and keeps AssemblyAI length limits", () => {
		const keyterms = buildAssemblyAiKeyterms([
			{ alias: "Proveedor" },
			{ alias: "proveedor" },
			{ alias: "  Ana Maria  " },
			{ alias: "x".repeat(51) },
			{ alias: "" },
		]);

		expect(keyterms).toEqual(["Proveedor", "Ana Maria"]);
	});

	test("caps keyterms at 100 aliases", () => {
		const keyterms = buildAssemblyAiKeyterms(
			Array.from({ length: 110 }, (_, index) => ({
				alias: `contacto-${index}`,
			})),
		);

		expect(keyterms).toHaveLength(100);
		expect(keyterms.at(-1)).toBe("contacto-99");
	});
});
