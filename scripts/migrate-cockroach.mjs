import { readFileSync } from "node:fs";
import postgres from "postgres";

const parse = (s) =>
  Object.fromEntries(
    s.split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
  );
const read = (f) => { try { return readFileSync(new URL(f, import.meta.url), "utf8"); } catch { return ""; } };
const env = { ...parse(read("../.env")), ...parse(read("../.env.local")) };

const src = postgres(env.DATABASE_URL, { max: 1, prepare: false });      // Neon
const dst = postgres(env.COCKROACH_URL, { max: 1, prepare: false });     // CockroachDB

// Parent tables first (FK-safe inserts).
const TABLES = [
  "profiles", "titles", "people", "config_options", "content_blocks",
  "config_versions", "audit_log", "title_embeddings", "user_taste",
  "watchlist_items", "ratings", "favourites",
];
const VECTOR_COL = { title_embeddings: "embedding", user_taste: "embedding" };
const PAGE = 1000;        // Neon read page (TCP, no size cap)
const INSERT_CHUNK = 300; // CockroachDB insert sub-batch (caps SQL msg at 16 MiB)

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

    const insertChunk = async (chunk) => {
      for (let i = 0; i < chunk.length; i += INSERT_CHUNK) {
        const part = chunk.slice(i, i + INSERT_CHUNK);
        if (vcol) {
          const params = [];
          const tuples = part.map((r) => `(${cols.map((c) => { params.push(r[c]); return c === vcol ? `$${params.length}::VECTOR` : `$${params.length}`; }).join(",")})`);
          await dst.unsafe(`INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`, params);
        } else {
          await dst`INSERT INTO ${dst(t)} ${dst(part, ...cols)} ON CONFLICT DO NOTHING`;
        }
      }
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
