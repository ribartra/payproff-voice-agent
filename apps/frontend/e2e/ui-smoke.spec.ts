import { expect, test } from "@playwright/test";

test("renders PayProof login shell without client errors", async ({ page }) => {
	const consoleErrors: string[] = [];
	page.on("console", (message) => {
		const text = message.text();
		const isExpectedAnonymousSessionProbe =
			text.includes("401") && text.includes("Unauthorized");
		if (message.type() === "error" && !isExpectedAnonymousSessionProbe) {
			consoleErrors.push(message.text());
		}
	});
	page.on("pageerror", (error) => {
		consoleErrors.push(error.message);
	});

	await page.goto("/", { waitUntil: "networkidle" });

	await expect(page.getByText("PayProof Voice Agent")).toBeVisible();
	await expect(
		page.getByRole("heading", { name: /Pagos preparados por voz/i }),
	).toBeVisible();
	await expect(page.getByLabel("Email")).toHaveValue("demo@payproof.local");
	await expect(page.getByLabel("Password")).toHaveValue("PayProofDemo2026!");

	expect(consoleErrors).toEqual([]);
});
