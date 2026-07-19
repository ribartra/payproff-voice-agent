import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config.js";
import { createPool } from "./db.js";

if (!env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required to run backend migrations.");
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(currentDir, "../sql/001_users_contacts.sql");
const sql = await readFile(sqlPath, "utf8");
const pool = createPool(env.DATABASE_URL);

try {
	await pool.query(sql);
	console.log("Applied backend SQL migrations and seed data.");
} finally {
	await pool.end();
}
