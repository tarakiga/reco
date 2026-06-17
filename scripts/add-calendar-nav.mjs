// One-off: add a "Calendar" link to the published nav. Mirrors what the admin
// publish flow does — upsert the option, then snapshot all nav options into a
// new published version. Idempotent.
import { readFileSync } from "node:fs";
import postgres from "postgres";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^COCKROACH_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false });

await sql`
  INSERT INTO config_options (namespace, key, label, value, sort_order, enabled, updated_by)
  VALUES ('nav','calendar','Calendar', ${sql.json({ href: "/calendar", label: "Calendar" })}, 5, true, 'script:add-calendar-nav')
  ON CONFLICT (namespace, key) DO UPDATE
    SET label = excluded.label, value = excluded.value, sort_order = excluded.sort_order,
        enabled = excluded.enabled, updated_at = now()
`;

const rows = await sql`SELECT key, label, value, sort_order, enabled FROM config_options WHERE namespace='nav' ORDER BY sort_order`;
const snapshot = rows.map((r) => ({
  key: r.key, label: r.label, value: r.value ?? null,
  sortOrder: Number(r.sort_order), enabled: r.enabled,
}));
const [{ max }] = await sql`SELECT coalesce(max(version),0) AS max FROM config_versions WHERE entity_type='options_namespace' AND entity_key='nav'`;
const version = Number(max) + 1;
await sql`
  INSERT INTO config_versions (entity_type, entity_key, version, snapshot, published_by)
  VALUES ('options_namespace','nav', ${version}, ${sql.json(snapshot)}, 'script:add-calendar-nav')
`;
console.log(`Published nav v${version} with ${snapshot.length} links: ${snapshot.map((s) => s.key).join(", ")}`);
await sql.end();
