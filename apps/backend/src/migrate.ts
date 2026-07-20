import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config.js";
import { createPool } from "./db.js";

if (!env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required to run backend migrations.");
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const sqlDir = resolve(currentDir, "../sql");
const pool = createPool(env.DATABASE_URL);

try {
	const files = (await readdir(sqlDir))
		.filter((file) => file.endsWith(".sql"))
		.toSorted();

	for (const file of files) {
		const sql = await readFile(resolve(sqlDir, file), "utf8");
		await pool.query(sql);
		console.log(`Applied ${file}.`);
	}
	console.log("Applied backend SQL migrations and seed data.");
} finally {
	await pool.end();
}
