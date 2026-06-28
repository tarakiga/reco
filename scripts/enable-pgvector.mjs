import { sql } from "./_db.mjs";

await sql`CREATE EXTENSION IF NOT EXISTS vector`;
await sql`
  CREATE TABLE IF NOT EXISTS title_embeddings (
    title_id uuid PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    model text NOT NULL,
    descriptor_hash text NOT NULL,
    built_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`
  CREATE TABLE IF NOT EXISTS user_taste (
    user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    rated_count integer NOT NULL DEFAULT 0,
    built_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS title_embeddings_hnsw
  ON title_embeddings USING hnsw (embedding vector_cosine_ops)`;
console.log("pgvector ready");
await sql.end();
