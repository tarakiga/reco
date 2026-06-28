// Shared Postgres (CockroachDB) connection for one-off maintenance scripts.
// Reads COCKROACH_URL (falling back to DATABASE_URL) from .env.local / .env so
// scripts hit the same cluster as the app. Remember to `await sql.end()` at the
// end of a script — postgres.js keeps the connection open otherwise.
import { readFileSync } from "node:fs";
import postgres from "postgres";

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(new URL(file, import.meta.url), "utf8")
        .split("\n")
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}

export const env = { ...readEnv("../.env"), ...readEnv("../.env.local") };
const url = env.COCKROACH_URL || env.DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("No COCKROACH_URL/DATABASE_URL found in .env.local or .env");

// prepare:false → simple protocol (matches the app; safer with CockroachDB).
export const sql = postgres(url, { max: 1, prepare: false });
