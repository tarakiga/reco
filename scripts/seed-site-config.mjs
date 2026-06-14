import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// ──────────────────────────────────────────────
// Nav options (namespace = "nav")
// ──────────────────────────────────────────────
const navOptions = [
  { key: "home",    label: "Home",      value: { href: "/",        label: "Home"      }, sortOrder: 0 },
  { key: "for-you", label: "For you",   value: { href: "/for-you", label: "For you"   }, sortOrder: 1 },
  { key: "movies",  label: "Movies",    value: { href: "/movies",  label: "Movies"    }, sortOrder: 2 },
  { key: "tv",      label: "TV Shows",  value: { href: "/tv",      label: "TV Shows"  }, sortOrder: 3 },
];

for (const opt of navOptions) {
  await sql`
    INSERT INTO config_options (namespace, key, label, value, sort_order, enabled, updated_by)
    VALUES ('nav', ${opt.key}, ${opt.label}, ${JSON.stringify(opt.value)}, ${opt.sortOrder}, true, 'seed')
    ON CONFLICT (namespace, key) DO UPDATE
      SET label      = EXCLUDED.label,
          value      = EXCLUDED.value,
          sort_order = EXCLUDED.sort_order,
          enabled    = EXCLUDED.enabled,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
  `;
  console.log(`Upserted nav option: ${opt.key}`);
}

// Build the snapshot as PublishedOption[]
const navSnapshot = navOptions.map((o) => ({
  key:       o.key,
  label:     o.label,
  value:     o.value,
  sortOrder: o.sortOrder,
  enabled:   true,
}));

// Publish nav v1 (idempotent — skip if a version already exists for this snapshot)
try {
  const [{ nextVer }] = await sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS "nextVer"
    FROM config_versions
    WHERE entity_type = 'options_namespace' AND entity_key = 'nav'
  `;
  await sql`
    INSERT INTO config_versions (entity_type, entity_key, version, snapshot, published_by)
    VALUES ('options_namespace', 'nav', ${nextVer}, ${JSON.stringify(navSnapshot)}, 'seed')
  `;
  console.log(`Published nav version ${nextVer}`);
} catch (err) {
  if (err?.code === "23505") {
    console.log("Nav version already published, skipping.");
  } else {
    throw err;
  }
}

// ──────────────────────────────────────────────
// Brand content block (key = "brand")
// ──────────────────────────────────────────────
await sql`
  INSERT INTO content_blocks (key, title, body, updated_by)
  VALUES ('brand', 'Brand name', '<p>reco</p>', 'seed')
  ON CONFLICT (key) DO UPDATE
    SET title      = EXCLUDED.title,
        body       = EXCLUDED.body,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
`;
console.log("Upserted brand content block");

const brandSnapshot = { key: "brand", title: "Brand name", body: "<p>reco</p>" };

try {
  const [{ nextVer }] = await sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS "nextVer"
    FROM config_versions
    WHERE entity_type = 'content_block' AND entity_key = 'brand'
  `;
  await sql`
    INSERT INTO config_versions (entity_type, entity_key, version, snapshot, published_by)
    VALUES ('content_block', 'brand', ${nextVer}, ${JSON.stringify(brandSnapshot)}, 'seed')
  `;
  console.log(`Published brand version ${nextVer}`);
} catch (err) {
  if (err?.code === "23505") {
    console.log("Brand version already published, skipping.");
  } else {
    throw err;
  }
}

console.log("Done. Seed complete.");
