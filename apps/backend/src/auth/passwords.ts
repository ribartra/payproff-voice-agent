import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, KEY_LENGTH, {
		N: SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
	}).toString("hex");

	return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, hash].join("$");
}

export function verifyPassword(password: string, storedHash: string): boolean {
	const [algorithm, n, r, p, salt, hash] = storedHash.split("$");

	if (algorithm !== "scrypt" || !n || !r || !p || !salt || !hash) {
		return false;
	}

	const candidate = scryptSync(password, salt, KEY_LENGTH, {
		N: Number(n),
		r: Number(r),
		p: Number(p),
	});
	const expected = Buffer.from(hash, "hex");

	return (
		expected.length === candidate.length && timingSafeEqual(expected, candidate)
	);
}
