import type { PayproofContact } from "./schemas.js";

export const ASSEMBLYAI_KEYTERMS_LIMIT = 100;
export const ASSEMBLYAI_KEYTERM_MAX_LENGTH = 50;

export function buildAssemblyAiKeyterms(
	contacts: Array<Pick<PayproofContact, "alias">>,
): string[] {
	const seen = new Set<string>();
	const keyterms: string[] = [];

	for (const contact of contacts) {
		const alias = contact.alias.trim();
		const key = alias.toLowerCase();

		if (
			!alias ||
			alias.length > ASSEMBLYAI_KEYTERM_MAX_LENGTH ||
			seen.has(key)
		) {
			continue;
		}

		seen.add(key);
		keyterms.push(alias);

		if (keyterms.length === ASSEMBLYAI_KEYTERMS_LIMIT) {
			break;
		}
	}

	return keyterms;
}
