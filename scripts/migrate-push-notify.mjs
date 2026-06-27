// Additive: web-push subscriptions + "notify me when it's on" alerts.
import { readFileSync } from "node:fs";
import postgres from "postgres";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) { console.error("COCKROACH_URL not found"); process.exit(1); }
const sql = postgres(url, { max: 1, prepare: false });
await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS notify_alerts (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, title_id)
  );`);
console.log("OK — push_subscriptions + notify_alerts ready");
await sql.end();
