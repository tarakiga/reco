// One-off: add "What can I do?" to the published nav (mirrors the admin publish).
import { readFileSync } from "node:fs";
import postgres from "postgres";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });
await sql`
  INSERT INTO config_options (namespace, key, label, value, sort_order, enabled, updated_by)
  VALUES ('nav','what-can-i-do','What can I do?', ${sql.json({ href: "/what-can-i-do", label: "What can I do?" })}, 6, true, 'script:add-whatcanido-nav')
  ON CONFLICT (namespace, key) DO UPDATE
    SET label = excluded.label, value = excluded.value, sort_order = excluded.sort_order,
        enabled = excluded.enabled, updated_at = now()
`;
const rows = await sql`SELECT key, label, value, sort_order, enabled FROM config_options WHERE namespace='nav' ORDER BY sort_order`;
const snapshot = rows.map((r) => ({ key: r.key, label: r.label, value: r.value ?? null, sortOrder: Number(r.sort_order), enabled: r.enabled }));
const [{ max }] = await sql`SELECT coalesce(max(version),0) AS max FROM config_versions WHERE entity_type='options_namespace' AND entity_key='nav'`;
const version = Number(max) + 1;
await sql`INSERT INTO config_versions (entity_type, entity_key, version, snapshot, published_by) VALUES ('options_namespace','nav', ${version}, ${sql.json(snapshot)}, 'script:add-whatcanido-nav')`;
console.log(`Published nav v${version}: ${snapshot.map((s) => s.key).join(", ")}`);
await sql.end();
