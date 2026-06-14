import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// CockroachDB over the standard Postgres wire. `prepare: false` uses the simple
// query protocol (safer with CockroachDB + serverless connection churn); `max: 1`
// keeps one connection per serverless instance (postgres.js pipelines on it).
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  prepare: false,
  idle_timeout: 20,
});
export const db = drizzle(client, { schema });
