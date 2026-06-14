import { readFileSync } from "node:fs";
import postgres from "postgres";

const parse = (s) =>
  Object.fromEntries(
    s.split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
  );
const read = (f) => { try { return readFileSync(new URL(f, import.meta.url), "utf8"); } catch { return ""; } };
const env = { ...parse(read("../.env")), ...parse(read("../.env.local")) };

// Source is always Neon. NEON_URL holds it when DATABASE_URL has been flipped to
// CockroachDB (flip-db.mjs); otherwise DATABASE_URL is still Neon.
const SRC = env.NEON_URL || env.DATABASE_URL;
const DST = env.COCKROACH_URL;
if (!SRC || !DST) { console.error("missing SRC or DST url"); process.exit(1); }
if (SRC === DST) { console.error("SRC === DST — refusing to clear+copy onto itself"); process.exit(1); }

const src = postgres(SRC, { max: 1, prepare: false });      // Neon
const dst = postgres(DST, { max: 1, prepare: false });      // CockroachDB

// Parent tables first (FK-safe inserts).
const TABLES = [
  "profiles", "titles", "people", "config_options", "content_blocks",
  "config_versions", "audit_log", "title_embeddings", "user_taste",
  "watchlist_items", "ratings", "favourites",
];
const VECTOR_COL = { title_embeddings: "embedding", user_taste: "embedding" };
const PAGE = 1000;           // Neon read page (TCP, no size cap)
const MAX_BYTES = 8_000_000; // size-aware insert batch (CockroachDB caps SQL msg at 16 MiB)
const MAX_ROWS = 400;        // also cap row count per insert

const colsOf = async (t) =>
  (await dst`SELECT column_name FROM information_schema.columns WHERE table_name = ${t} AND table_schema = 'public' ORDER BY ordinal_position`).map((c) => c.column_name);

try {
  for (const t of [...TABLES].reverse()) await dst.unsafe(`DELETE FROM ${t}`);
  console.log("cleared target tables");

  // Large tables: keyset-paginate by their unique uuid PK (robust against
  // concurrent prod writes + O(n)). Everything else is tiny — read in one shot.
  const KEYSET = { titles: "id", title_embeddings: "title_id" };
  // Parent PKs we collect, and child FKs we must filter against (prod may add
  // titles/embeddings mid-migration; skip children whose parent wasn't copied).
  const PK = { titles: "id", profiles: "id" };
  const FK = {
    title_embeddings: [["title_id", "titles"]],
    user_taste: [["user_id", "profiles"]],
    watchlist_items: [["user_id", "profiles"], ["title_id", "titles"]],
    ratings: [["user_id", "profiles"], ["title_id", "titles"]],
    favourites: [["user_id", "profiles"], ["title_id", "titles"]],
  };
  const parentIds = { titles: new Set(), profiles: new Set() };

  for (const t of TABLES) {
    const cols = await colsOf(t);
    const vcol = VECTOR_COL[t];
    const key = KEYSET[t];
    const pk = PK[t];
    const fks = FK[t];

    const insertPart = async (part) => {
      if (!part.length) return;
      if (vcol) {
        const params = [];
        const tuples = part.map((r) => `(${cols.map((c) => { params.push(r[c]); return c === vcol ? `$${params.length}::VECTOR` : `$${params.length}`; }).join(",")})`);
        await dst.unsafe(`INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`, params);
      } else {
        await dst`INSERT INTO ${dst(t)} ${dst(part, ...cols)} ON CONFLICT DO NOTHING`;
      }
    };
    // Size-aware batching: rows vary a lot in metadata size, so flush by bytes
    // (and a row cap) rather than a fixed count, to stay under the 16 MiB cap.
    const insertChunk = async (chunk) => {
      let batch = [];
      let bytes = 0;
      for (const r of chunk) {
        const sz = JSON.stringify(r).length;
        if (batch.length && (bytes + sz > MAX_BYTES || batch.length >= MAX_ROWS)) {
          await insertPart(batch);
          batch = [];
          bytes = 0;
        }
        batch.push(r);
        bytes += sz;
      }
      await insertPart(batch);
    };

    const processRows = async (rows) => {
      if (pk) for (const r of rows) parentIds[t].add(r[pk]);
      const kept = fks ? rows.filter((r) => fks.every(([col, parent]) => parentIds[parent].has(r[col]))) : rows;
      await insertChunk(kept);
      return kept.length;
    };

    let total = 0;
    if (key) {
      let last = null;
      while (true) {
        const rows = last == null
          ? await src.unsafe(`SELECT * FROM ${t} ORDER BY "${key}" LIMIT ${PAGE}`)
          : await src.unsafe(`SELECT * FROM ${t} WHERE "${key}" > $1::uuid ORDER BY "${key}" LIMIT ${PAGE}`, [last]);
        if (rows.length === 0) break;
        total += await processRows(rows);
        last = rows[rows.length - 1][key];
      }
    } else {
      total = await processRows(await src.unsafe(`SELECT * FROM ${t}`));
    }
    console.log(`${t.padEnd(18)} ${total}`);
  }
  console.log("MIGRATION COMPLETE");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await src.end();
  await dst.end();
}
