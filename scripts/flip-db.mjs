// Flip .env.local DATABASE_URL between Neon and CockroachDB without printing secrets.
// Usage: node scripts/flip-db.mjs cockroach | neon
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../.env.local", import.meta.url);
const dir = process.argv[2];
let txt = readFileSync(path, "utf8");

const get = (k) => txt.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.replace(/\r$/, "");
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  if (re.test(txt)) txt = txt.replace(re, () => `${k}=${v}`);
  else txt = txt.replace(/\n*$/, () => `\n${k}=${v}\n`);
};

const cur = get("DATABASE_URL");
const cockroach = get("COCKROACH_URL");
let neon = get("NEON_URL");

if (dir === "cockroach") {
  if (!cockroach) { console.error("COCKROACH_URL not found in .env.local"); process.exit(1); }
  if (!neon) { set("NEON_URL", cur); neon = cur; } // back up the current (Neon) URL once
  set("DATABASE_URL", cockroach);
  writeFileSync(path, txt);
  console.log("DATABASE_URL -> CockroachDB  (NEON_URL backup present:", !!neon, ")");
} else if (dir === "neon") {
  if (!neon) { console.error("no NEON_URL backup to roll back to"); process.exit(1); }
  set("DATABASE_URL", neon);
  writeFileSync(path, txt);
  console.log("DATABASE_URL -> Neon  (rollback)");
} else {
  console.error("usage: node scripts/flip-db.mjs cockroach | neon");
  process.exit(1);
}
