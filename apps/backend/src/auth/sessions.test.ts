import { describe, expect, test } from "bun:test";
import {
	buildExpiredSessionCookie,
	buildSessionCookie,
	parseCookie,
} from "./sessions.js";

describe("session cookies", () => {
	test("builds and parses the session cookie", () => {
		const cookie = buildSessionCookie({
			name: "pp_session",
			value: "session-id",
			maxAgeSeconds: 60,
		});

		expect(cookie).toContain("HttpOnly");
		expect(parseCookie(`other=1; ${cookie}`, "pp_session")).toBe("session-id");
		expect(buildExpiredSessionCookie("pp_session")).toContain("Max-Age=0");
	});
});
