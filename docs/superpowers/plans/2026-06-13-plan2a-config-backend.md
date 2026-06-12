# Plan 2a: Config System Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The data layer, services, and APIs for the build-guide-mandated config system: config options + content blocks with a working-copy/published-snapshot model, version history, rollback, audit logging, role-gated admin endpoints, and a cached public read API.

**Architecture:** `config_options` and `content_blocks` tables are the always-editable WORKING COPY. Publishing snapshots the entity into `config_versions` (immutable, monotonically versioned) and busts the cache tag; the public API serves only the latest snapshot, so drafts are invisible until published. Rollback copies an old snapshot back into the working copy (it becomes a draft — re-publish to go live). Every mutation writes `audit_log`. Services are pure data logic (no Next.js cache calls) so they're testable; cache revalidation lives in the route layer.

**Tech Stack:** Drizzle + Neon (existing), Zod (new), Next.js route handlers, Clerk session via existing `getCurrentProfile()`.

**Spec:** `docs/superpowers/specs/2026-06-12-reco-v1-design.md` sections 4.1, 5.
**Plan 2b (admin UI) is a separate plan, written after this one completes.**

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `plan-2a-config-backend` (create from master at start: `git checkout -b plan-2a-config-backend`). Commit after every task. TDD steps must observe the failure. `DATABASE_URL` is live in `.env`/`.env.local` — service tests run against the real Neon db using throwaway `__vitest__*` namespaces with cleanup. Never print env values.

---

### Task 1: Config schema + db push + promote-admin script

**Files:**
- Modify: `src/db/schema.ts` (append tables)
- Create: `scripts/promote-admin.mjs`
- Modify: `package.json` (script)

- [ ] **Step 1: Append to `src/db/schema.ts`** (keep existing content; add imports as needed — final import line should be `import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";`)

```ts
export const configOptions = pgTable(
  "config_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: jsonb("value"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("config_options_ns_key").on(t.namespace, t.key)],
);

export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const configEntityTypeEnum = pgEnum("config_entity_type", [
  "options_namespace",
  "content_block",
]);

export const configVersions = pgTable(
  "config_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: configEntityTypeEnum("entity_type").notNull(),
    entityKey: text("entity_key").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    publishedBy: text("published_by").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("config_versions_entity_version").on(t.entityType, t.entityKey, t.version)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConfigOptionRow = typeof configOptions.$inferSelect;
export type ContentBlockRow = typeof contentBlocks.$inferSelect;
export type ConfigVersionRow = typeof configVersions.$inferSelect;
```

- [ ] **Step 2: Push schema**

Run: `npm run db:push -- --force`
Expected: new tables created, `profiles` untouched (output lists only additions — if it proposes dropping/altering profiles, STOP and report BLOCKED).

- [ ] **Step 3: Create `scripts/promote-admin.mjs`** (the first admin must be promoted out-of-band; admin APIs require the role)

```js
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const username = process.argv[2];
const role = process.argv[3] ?? "admin";
if (!username || !["admin", "editor", "user"].includes(role)) {
  console.error("Usage: node scripts/promote-admin.mjs <username> [admin|editor|user]");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`UPDATE profiles SET role = ${role} WHERE username = ${username} RETURNING username, role`;
if (rows.length === 0) {
  console.error(`No profile with username "${username}". Sign in once first.`);
  process.exit(1);
}
console.log(`${rows[0].username} is now ${rows[0].role}`);
```

Add to `package.json` scripts: `"promote": "node scripts/promote-admin.mjs"`.

- [ ] **Step 4: Verify**

`npx tsc --noEmit` clean; `npm run test` still 41. Run `node scripts/promote-admin.mjs nonexistent-user` — expect the "No profile" error path (exit 1), proving db connectivity without changing data.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: config system schema (options, blocks, versions, audit) and promote script"
```

---

### Task 2: Zod contracts + server-only test stub (TDD)

**Files:**
- Create: `src/lib/contracts/config.ts`, `src/lib/contracts/config.test.ts`, `src/test/server-only-stub.ts`
- Modify: `vitest.config.ts` (alias), `package.json` (zod dep)

- [ ] **Step 1: Install**

```
npm install zod
```

- [ ] **Step 2: Create the server-only stub** — `src/test/server-only-stub.ts`:

```ts
// Vitest runs outside the React Server runtime; "server-only" throws there.
// Tests alias the package to this empty module. Next.js still enforces the
// real guard in app builds.
export {};
```

In `vitest.config.ts`, add to the top-level `resolve.alias` object (alongside the existing `"@"` entry):

```ts
"server-only": path.resolve(dirname, "./src/test/server-only-stub.ts"),
```

- [ ] **Step 3: Write the failing test** — `src/lib/contracts/config.test.ts`:

```ts
import {
  upsertOptionInput,
  reorderInput,
  publishInput,
  rollbackInput,
  upsertBlockInput,
} from "./config";

test("accepts a valid option upsert", () => {
  const r = upsertOptionInput.safeParse({
    namespace: "nav",
    key: "home",
    label: "Home",
    value: { href: "/" },
  });
  expect(r.success).toBe(true);
});

test("rejects bad namespace characters and empty label", () => {
  expect(
    upsertOptionInput.safeParse({ namespace: "Bad Space", key: "k", label: "L" }).success,
  ).toBe(false);
  expect(
    upsertOptionInput.safeParse({ namespace: "nav", key: "k", label: "" }).success,
  ).toBe(false);
});

test("reorder requires at least one key", () => {
  expect(reorderInput.safeParse({ namespace: "nav", orderedKeys: [] }).success).toBe(false);
  expect(reorderInput.safeParse({ namespace: "nav", orderedKeys: ["a", "b"] }).success).toBe(true);
});

test("publish/rollback shapes", () => {
  expect(
    publishInput.safeParse({ entityType: "options_namespace", entityKey: "nav" }).success,
  ).toBe(true);
  expect(publishInput.safeParse({ entityType: "bogus", entityKey: "nav" }).success).toBe(false);
  expect(
    rollbackInput.safeParse({ entityType: "content_block", entityKey: "about", version: 2 }).success,
  ).toBe(true);
  expect(
    rollbackInput.safeParse({ entityType: "content_block", entityKey: "about", version: 0 }).success,
  ).toBe(false);
});

test("content block requires non-empty body", () => {
  expect(upsertBlockInput.safeParse({ key: "about", title: "About", body: "" }).success).toBe(false);
  expect(
    upsertBlockInput.safeParse({ key: "about", title: "About", body: "<p>Hi</p>" }).success,
  ).toBe(true);
});
```

- [ ] **Step 4: Run to verify failure**

`npx vitest run src/lib/contracts/config.test.ts` → FAIL (cannot resolve `./config`)

- [ ] **Step 5: Implement** — `src/lib/contracts/config.ts`:

```ts
import { z } from "zod";

export const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits, hyphens");

export const entityType = z.enum(["options_namespace", "content_block"]);

export const upsertOptionInput = z.object({
  namespace: slug,
  key: slug,
  label: z.string().min(1).max(120),
  value: z.unknown().optional(),
  sortOrder: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});
export type UpsertOptionInput = z.infer<typeof upsertOptionInput>;

export const deleteOptionInput = z.object({ namespace: slug, key: slug });

export const reorderInput = z.object({
  namespace: slug,
  orderedKeys: z.array(slug).min(1),
});
export type ReorderInput = z.infer<typeof reorderInput>;

export const publishInput = z.object({ entityType, entityKey: slug });
export type PublishInput = z.infer<typeof publishInput>;

export const rollbackInput = z.object({
  entityType,
  entityKey: slug,
  version: z.number().int().min(1),
});
export type RollbackInput = z.infer<typeof rollbackInput>;

export const upsertBlockInput = z.object({
  key: slug,
  title: z.string().min(1).max(160),
  body: z.string().min(1),
});
export type UpsertBlockInput = z.infer<typeof upsertBlockInput>;

/** Shape stored in options_namespace snapshots and served publicly. */
export const publishedOption = z.object({
  key: z.string(),
  label: z.string(),
  value: z.unknown().nullable(),
  sortOrder: z.number().int(),
  enabled: z.boolean(),
});
export type PublishedOption = z.infer<typeof publishedOption>;

export const publishedBlock = z.object({
  key: z.string(),
  title: z.string(),
  body: z.string(),
});
export type PublishedBlock = z.infer<typeof publishedBlock>;
```

- [ ] **Step 6: Verify** — contract tests pass (5), full suite 46, `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: zod contracts for config system; server-only vitest stub"
```

---

### Task 3: Options service — working-copy CRUD + reorder (TDD vs live db)

**Files:**
- Create: `src/services/config.ts`, `src/services/config.test.ts`, `src/services/audit.ts`

- [ ] **Step 1: Create the audit helper** — `src/services/audit.ts`:

```ts
import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function writeAudit(entry: {
  actor: string;
  action: string;
  entityType: string;
  entityKey: string;
  detail?: unknown;
}) {
  await db.insert(auditLog).values({ ...entry, detail: entry.detail ?? null });
}
```

- [ ] **Step 2: Write the failing test** — `src/services/config.test.ts`. Integration tests against the live Neon db, isolated via a unique namespace per run and cleaned up after:

```ts
import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { auditLog, configOptions, configVersions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  listOptions,
  upsertOption,
  deleteOption,
  reorderOptions,
} from "./config";

const NS = `__vitest__${Date.now()}`;
const ACTOR = "vitest";

async function cleanup() {
  await db.delete(configOptions).where(eq(configOptions.namespace, NS));
  await db
    .delete(configVersions)
    .where(and(eq(configVersions.entityType, "options_namespace"), eq(configVersions.entityKey, NS)));
  await db.delete(auditLog).where(eq(auditLog.entityKey, NS));
}

beforeAll(cleanup);
afterAll(cleanup);

test("upsert creates then updates an option", async () => {
  await upsertOption({ namespace: NS, key: "home", label: "Home", value: { href: "/" } }, ACTOR);
  let rows = await listOptions(NS);
  expect(rows).toHaveLength(1);
  expect(rows[0].label).toBe("Home");

  await upsertOption({ namespace: NS, key: "home", label: "Start", value: { href: "/" } }, ACTOR);
  rows = await listOptions(NS);
  expect(rows).toHaveLength(1);
  expect(rows[0].label).toBe("Start");
});

test("reorder rewrites sortOrder by position and rejects non-permutations", async () => {
  await upsertOption({ namespace: NS, key: "a", label: "A" }, ACTOR);
  await upsertOption({ namespace: NS, key: "b", label: "B" }, ACTOR);
  await reorderOptions({ namespace: NS, orderedKeys: ["b", "home", "a"] }, ACTOR);
  const rows = await listOptions(NS);
  expect(rows.map((r) => r.key)).toEqual(["b", "home", "a"]);

  await expect(
    reorderOptions({ namespace: NS, orderedKeys: ["b"] }, ACTOR),
  ).rejects.toThrow(/permutation/i);
});

test("delete removes the option", async () => {
  await deleteOption(NS, "a", ACTOR);
  const rows = await listOptions(NS);
  expect(rows.map((r) => r.key)).toEqual(["b", "home"]);
});

test("mutations are audited", async () => {
  const entries = await db.select().from(auditLog).where(eq(auditLog.entityKey, NS));
  expect(entries.length).toBeGreaterThanOrEqual(5);
  expect(entries.every((e) => e.actor === ACTOR)).toBe(true);
});
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/services/config.test.ts` → FAIL (cannot resolve `./config`)

- [ ] **Step 4: Implement (CRUD portion)** — `src/services/config.ts`:

```ts
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configOptions, type ConfigOptionRow } from "@/db/schema";
import { writeAudit } from "./audit";
import type { ReorderInput, UpsertOptionInput } from "@/lib/contracts/config";

export async function listOptions(namespace: string): Promise<ConfigOptionRow[]> {
  return db
    .select()
    .from(configOptions)
    .where(eq(configOptions.namespace, namespace))
    .orderBy(asc(configOptions.sortOrder), asc(configOptions.key));
}

export async function upsertOption(input: UpsertOptionInput, actor: string) {
  const values = {
    namespace: input.namespace,
    key: input.key,
    label: input.label,
    value: input.value ?? null,
    sortOrder: input.sortOrder ?? 0,
    enabled: input.enabled ?? true,
    updatedBy: actor,
    updatedAt: new Date(),
  };
  await db
    .insert(configOptions)
    .values(values)
    .onConflictDoUpdate({
      target: [configOptions.namespace, configOptions.key],
      set: {
        label: values.label,
        value: values.value,
        sortOrder: values.sortOrder,
        enabled: values.enabled,
        updatedBy: actor,
        updatedAt: values.updatedAt,
      },
    });
  await writeAudit({
    actor,
    action: "option.upsert",
    entityType: "options_namespace",
    entityKey: input.namespace,
    detail: { key: input.key },
  });
}

export async function deleteOption(namespace: string, key: string, actor: string) {
  await db
    .delete(configOptions)
    .where(and(eq(configOptions.namespace, namespace), eq(configOptions.key, key)));
  await writeAudit({
    actor,
    action: "option.delete",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { key },
  });
}

export async function reorderOptions(input: ReorderInput, actor: string) {
  const existing = await listOptions(input.namespace);
  const existingKeys = existing.map((r) => r.key).sort();
  const orderedSorted = [...input.orderedKeys].sort();
  if (
    existingKeys.length !== orderedSorted.length ||
    existingKeys.some((k, i) => k !== orderedSorted[i])
  ) {
    throw new Error("orderedKeys must be a permutation of the namespace's keys");
  }
  for (let i = 0; i < input.orderedKeys.length; i++) {
    await db
      .update(configOptions)
      .set({ sortOrder: i, updatedBy: actor, updatedAt: new Date() })
      .where(
        and(
          eq(configOptions.namespace, input.namespace),
          eq(configOptions.key, input.orderedKeys[i]),
        ),
      );
  }
  await writeAudit({
    actor,
    action: "option.reorder",
    entityType: "options_namespace",
    entityKey: input.namespace,
    detail: { orderedKeys: input.orderedKeys },
  });
}
```

- [ ] **Step 5: Verify** — service tests pass (4); full suite 50; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: config options service (CRUD, reorder, audit) with live-db tests"
```

---

### Task 4: Versioning — publish, published reads, history, rollback (TDD)

**Files:**
- Modify: `src/services/config.ts` (append), `src/services/config.test.ts` (append tests)

- [ ] **Step 1: Append failing tests** to `src/services/config.test.ts`:

```ts
import {
  publishOptionsNamespace,
  getPublishedOptions,
  listVersions,
  rollbackOptionsNamespace,
} from "./config";

test("publishing an empty namespace is rejected", async () => {
  await expect(publishOptionsNamespace("__vitest__empty", ACTOR)).rejects.toThrow(/empty/i);
});

test("publish snapshots and bumps version; public read serves latest snapshot only", async () => {
  expect(await getPublishedOptions(NS)).toBeNull(); // nothing published yet

  const v1 = await publishOptionsNamespace(NS, ACTOR);
  expect(v1).toBe(1);

  await upsertOption({ namespace: NS, key: "new", label: "Draft only" }, ACTOR);
  const pub = await getPublishedOptions(NS);
  expect(pub!.version).toBe(1);
  expect(pub!.options.map((o) => o.key)).not.toContain("new"); // draft invisible

  const v2 = await publishOptionsNamespace(NS, ACTOR);
  expect(v2).toBe(2);
  expect((await getPublishedOptions(NS))!.options.map((o) => o.key)).toContain("new");
});

test("listVersions returns descending history", async () => {
  const versions = await listVersions("options_namespace", NS);
  expect(versions.map((v) => v.version)).toEqual([2, 1]);
});

test("rollback restores an old snapshot into the working copy as draft", async () => {
  await rollbackOptionsNamespace(NS, 1, ACTOR);
  const working = await listOptions(NS);
  expect(working.map((r) => r.key)).not.toContain("new"); // v1 had no "new"
  expect((await getPublishedOptions(NS))!.version).toBe(2); // published unchanged until re-publish
});
```

- [ ] **Step 2: Run to verify failure** — the new tests fail (functions not exported).

- [ ] **Step 3: Append implementation** to `src/services/config.ts`:

```ts
import { desc } from "drizzle-orm";
import { configVersions, type ConfigVersionRow } from "@/db/schema";
import { publishedOption, type PublishedOption } from "@/lib/contracts/config";

export async function publishOptionsNamespace(namespace: string, actor: string): Promise<number> {
  const rows = await listOptions(namespace);
  if (rows.length === 0) {
    throw new Error(`Cannot publish empty namespace "${namespace}"`);
  }
  const snapshot: PublishedOption[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value ?? null,
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  }));
  const latest = await latestVersion("options_namespace", namespace);
  const version = (latest?.version ?? 0) + 1;
  await db.insert(configVersions).values({
    entityType: "options_namespace",
    entityKey: namespace,
    version,
    snapshot,
    publishedBy: actor,
  });
  await writeAudit({
    actor,
    action: "namespace.publish",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { version },
  });
  return version;
}

async function latestVersion(
  entityType: "options_namespace" | "content_block",
  entityKey: string,
): Promise<ConfigVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(and(eq(configVersions.entityType, entityType), eq(configVersions.entityKey, entityKey)))
    .orderBy(desc(configVersions.version))
    .limit(1);
  return row;
}

export async function getPublishedOptions(
  namespace: string,
): Promise<{ version: number; options: PublishedOption[] } | null> {
  const row = await latestVersion("options_namespace", namespace);
  if (!row) return null;
  const options = publishedOption.array().parse(row.snapshot);
  return { version: row.version, options };
}

export async function listVersions(
  entityType: "options_namespace" | "content_block",
  entityKey: string,
) {
  return db
    .select({
      version: configVersions.version,
      publishedBy: configVersions.publishedBy,
      publishedAt: configVersions.publishedAt,
    })
    .from(configVersions)
    .where(and(eq(configVersions.entityType, entityType), eq(configVersions.entityKey, entityKey)))
    .orderBy(desc(configVersions.version));
}

export async function rollbackOptionsNamespace(namespace: string, version: number, actor: string) {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(
      and(
        eq(configVersions.entityType, "options_namespace"),
        eq(configVersions.entityKey, namespace),
        eq(configVersions.version, version),
      ),
    );
  if (!row) throw new Error(`No version ${version} for namespace "${namespace}"`);
  const options = publishedOption.array().parse(row.snapshot);
  await db.delete(configOptions).where(eq(configOptions.namespace, namespace));
  if (options.length > 0) {
    await db.insert(configOptions).values(
      options.map((o) => ({
        namespace,
        key: o.key,
        label: o.label,
        value: o.value ?? null,
        sortOrder: o.sortOrder,
        enabled: o.enabled,
        updatedBy: actor,
        updatedAt: new Date(),
      })),
    );
  }
  await writeAudit({
    actor,
    action: "namespace.rollback",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { restoredVersion: version },
  });
}
```

(Merge the new drizzle imports into the existing import lines rather than duplicating import statements.)

- [ ] **Step 4: Verify** — all config service tests pass (8); full suite 54; tsc clean.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: config publish/versions/rollback with snapshot model"
```

---

### Task 5: Content blocks service (TDD)

**Files:**
- Create: `src/services/content.ts`, `src/services/content.test.ts`

- [ ] **Step 1: Write the failing test** — `src/services/content.test.ts`:

```ts
import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { auditLog, contentBlocks, configVersions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getBlock,
  upsertBlock,
  publishBlock,
  getPublishedBlock,
  rollbackBlock,
} from "./content";

const KEY = `__vitest__block${Date.now()}`;
const ACTOR = "vitest";

async function cleanup() {
  await db.delete(contentBlocks).where(eq(contentBlocks.key, KEY));
  await db
    .delete(configVersions)
    .where(and(eq(configVersions.entityType, "content_block"), eq(configVersions.entityKey, KEY)));
  await db.delete(auditLog).where(eq(auditLog.entityKey, KEY));
}

beforeAll(cleanup);
afterAll(cleanup);

test("upsert + get working copy", async () => {
  await upsertBlock({ key: KEY, title: "About", body: "<p>v1</p>" }, ACTOR);
  const block = await getBlock(KEY);
  expect(block?.body).toBe("<p>v1</p>");
});

test("publish then draft edit: public read stays at published version", async () => {
  expect(await getPublishedBlock(KEY)).toBeNull();
  const v1 = await publishBlock(KEY, ACTOR);
  expect(v1).toBe(1);

  await upsertBlock({ key: KEY, title: "About", body: "<p>v2 draft</p>" }, ACTOR);
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v1</p>");

  await publishBlock(KEY, ACTOR);
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v2 draft</p>");
});

test("publishing a missing block is rejected", async () => {
  await expect(publishBlock("__vitest__missing", ACTOR)).rejects.toThrow(/no content block/i);
});

test("rollback restores old body into working copy", async () => {
  await rollbackBlock(KEY, 1, ACTOR);
  expect((await getBlock(KEY))?.body).toBe("<p>v1</p>");
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v2 draft</p>"); // unchanged until re-publish
});
```

- [ ] **Step 2: Run to verify failure** — cannot resolve `./content`.

- [ ] **Step 3: Implement** — `src/services/content.ts`:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { configVersions, contentBlocks, type ContentBlockRow } from "@/db/schema";
import { writeAudit } from "./audit";
import { publishedBlock, type PublishedBlock, type UpsertBlockInput } from "@/lib/contracts/config";
import { listVersions } from "./config";

export async function getBlock(key: string): Promise<ContentBlockRow | null> {
  const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, key));
  return row ?? null;
}

export async function listBlocks(): Promise<ContentBlockRow[]> {
  return db.select().from(contentBlocks).orderBy(contentBlocks.key);
}

export async function upsertBlock(input: UpsertBlockInput, actor: string) {
  await db
    .insert(contentBlocks)
    .values({ ...input, updatedBy: actor, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: contentBlocks.key,
      set: { title: input.title, body: input.body, updatedBy: actor, updatedAt: new Date() },
    });
  await writeAudit({ actor, action: "block.upsert", entityType: "content_block", entityKey: input.key });
}

export async function publishBlock(key: string, actor: string): Promise<number> {
  const block = await getBlock(key);
  if (!block) throw new Error(`No content block "${key}" to publish`);
  const snapshot: PublishedBlock = { key: block.key, title: block.title, body: block.body };
  const versions = await listVersions("content_block", key);
  const version = (versions[0]?.version ?? 0) + 1;
  await db.insert(configVersions).values({
    entityType: "content_block",
    entityKey: key,
    version,
    snapshot,
    publishedBy: actor,
  });
  await writeAudit({
    actor,
    action: "block.publish",
    entityType: "content_block",
    entityKey: key,
    detail: { version },
  });
  return version;
}

export async function getPublishedBlock(key: string): Promise<PublishedBlock | null> {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(and(eq(configVersions.entityType, "content_block"), eq(configVersions.entityKey, key)))
    .orderBy(desc(configVersions.version))
    .limit(1);
  if (!row) return null;
  return publishedBlock.parse(row.snapshot);
}

export async function rollbackBlock(key: string, version: number, actor: string) {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(
      and(
        eq(configVersions.entityType, "content_block"),
        eq(configVersions.entityKey, key),
        eq(configVersions.version, version),
      ),
    );
  if (!row) throw new Error(`No version ${version} for content block "${key}"`);
  const snap = publishedBlock.parse(row.snapshot);
  await upsertBlock({ key: snap.key, title: snap.title, body: snap.body }, actor);
  await writeAudit({
    actor,
    action: "block.rollback",
    entityType: "content_block",
    entityKey: key,
    detail: { restoredVersion: version },
  });
}
```

(Add `desc` to the drizzle-orm import line. Final file order: imports, getBlock, listBlocks, upsertBlock, publishBlock, getPublishedBlock, rollbackBlock.)

- [ ] **Step 4: Verify** — content tests pass (4); full suite 58; tsc clean.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: content blocks service with publish/rollback"
```

---

### Task 6: Authorization guard (TDD on rank logic)

**Files:**
- Create: `src/services/authz.ts`, `src/lib/roles.ts`, `src/lib/roles.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/roles.test.ts`:

```ts
import { hasRole } from "./roles";

test("role ranking", () => {
  expect(hasRole("admin", "editor")).toBe(true);
  expect(hasRole("admin", "admin")).toBe(true);
  expect(hasRole("editor", "admin")).toBe(false);
  expect(hasRole("editor", "editor")).toBe(true);
  expect(hasRole("user", "editor")).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/roles.ts`:

```ts
export type Role = "user" | "editor" | "admin";

const RANK: Record<Role, number> = { user: 0, editor: 1, admin: 2 };

export function hasRole(actual: Role, minimum: Role): boolean {
  return RANK[actual] >= RANK[minimum];
}
```

- [ ] **Step 3: Implement the guard** — `src/services/authz.ts`:

```ts
import "server-only";
import type { Profile } from "@/db/schema";
import { hasRole, type Role } from "@/lib/roles";
import { getCurrentProfile } from "./profile";

export class AuthzError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** Returns the current profile if it meets the minimum role; throws AuthzError otherwise. */
export async function requireRole(minimum: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthzError(401, "Sign in required");
  if (!hasRole(profile.role, minimum)) throw new AuthzError(403, `Requires ${minimum} role`);
  return profile;
}
```

- [ ] **Step 4: Verify** — roles tests pass (1 test, 5 assertions); suite 59; tsc clean.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: role ranking and requireRole authz guard"
```

---

### Task 7: Admin API routes

**Files:**
- Create: `src/app/api/v1/admin/config/options/route.ts`
- Create: `src/app/api/v1/admin/config/options/reorder/route.ts`
- Create: `src/app/api/v1/admin/config/publish/route.ts`
- Create: `src/app/api/v1/admin/config/rollback/route.ts`
- Create: `src/app/api/v1/admin/config/versions/route.ts`
- Create: `src/app/api/v1/admin/config/content-blocks/route.ts`
- Create: `src/lib/api.ts`

- [ ] **Step 1: Create the route helper** — `src/lib/api.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthzError } from "@/services/authz";

export function jsonError(status: number, message: string, issues?: unknown) {
  return NextResponse.json({ error: message, issues }, { status });
}

/** Parse a request JSON body against a schema; throws ZodError on mismatch. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => {
    throw new ZodError([{ code: "custom", message: "Invalid JSON body", path: [] }]);
  });
  return schema.parse(body);
}

/** Wrap a handler with uniform authz/validation error mapping. */
export function withErrorMapping(
  handler: (req: Request) => Promise<NextResponse>,
): (req: Request) => Promise<NextResponse> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AuthzError) return jsonError(err.status, err.message);
      if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
      if (err instanceof Error && /cannot publish|no version|no content block|permutation/i.test(err.message)) {
        return jsonError(422, err.message);
      }
      console.error(err);
      return jsonError(500, "Internal error");
    }
  };
}
```

NOTE on Zod v4: if `err.issues` doesn't exist or `ZodError` import path differs in the installed zod version, adapt (`error.errors` in v3, `error.issues` in v4) — check `node_modules/zod` and use the installed API.

- [ ] **Step 2: Options CRUD route** — `src/app/api/v1/admin/config/options/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOptionInput, slug, upsertOptionInput } from "@/lib/contracts/config";
import { jsonError, parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { deleteOption, listOptions, upsertOption } from "@/services/config";

export const GET = withErrorMapping(async (req) => {
  await requireRole("editor");
  const ns = new URL(req.url).searchParams.get("namespace");
  const parsed = slug.safeParse(ns);
  if (!parsed.success) return jsonError(400, "namespace query param required");
  return NextResponse.json({ options: await listOptions(parsed.data) });
});

export const PUT = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const input = await parseBody(req, upsertOptionInput);
  await upsertOption(input, profile.username);
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const url = new URL(req.url);
  const input = deleteOptionInput.parse({
    namespace: url.searchParams.get("namespace"),
    key: url.searchParams.get("key"),
  });
  await deleteOption(input.namespace, input.key, profile.username);
  return NextResponse.json({ ok: true });
});
```

(`z` import only if needed; remove unused imports before committing.)

- [ ] **Step 3: Reorder route** — `src/app/api/v1/admin/config/options/reorder/route.ts`:

```ts
import { NextResponse } from "next/server";
import { reorderInput } from "@/lib/contracts/config";
import { parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { reorderOptions } from "@/services/config";

export const POST = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const input = await parseBody(req, reorderInput);
  await reorderOptions(input, profile.username);
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 4: Publish route (with cache busting)** — `src/app/api/v1/admin/config/publish/route.ts`:

```ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { publishInput } from "@/lib/contracts/config";
import { parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { publishOptionsNamespace } from "@/services/config";
import { publishBlock } from "@/services/content";

export const POST = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const input = await parseBody(req, publishInput);
  const version =
    input.entityType === "options_namespace"
      ? await publishOptionsNamespace(input.entityKey, profile.username)
      : await publishBlock(input.entityKey, profile.username);
  revalidateTag(`config:${input.entityType}:${input.entityKey}`);
  return NextResponse.json({ ok: true, version });
});
```

NOTE: in Next 16, `revalidateTag` may require a second argument or be supplemented by `updateTag` — check the installed `next/cache` exports and use the documented call for this version; the requirement is: the tag `config:<entityType>:<entityKey>` is invalidated on publish.

- [ ] **Step 5: Rollback + versions routes**

`src/app/api/v1/admin/config/rollback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { rollbackInput } from "@/lib/contracts/config";
import { parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { rollbackOptionsNamespace } from "@/services/config";
import { rollbackBlock } from "@/services/content";

export const POST = withErrorMapping(async (req) => {
  const profile = await requireRole("admin");
  const input = await parseBody(req, rollbackInput);
  if (input.entityType === "options_namespace") {
    await rollbackOptionsNamespace(input.entityKey, input.version, profile.username);
  } else {
    await rollbackBlock(input.entityKey, input.version, profile.username);
  }
  return NextResponse.json({ ok: true });
});
```

`src/app/api/v1/admin/config/versions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { entityType as entityTypeSchema, slug } from "@/lib/contracts/config";
import { jsonError, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { listVersions } from "@/services/config";

export const GET = withErrorMapping(async (req) => {
  await requireRole("editor");
  const url = new URL(req.url);
  const et = entityTypeSchema.safeParse(url.searchParams.get("entityType"));
  const key = slug.safeParse(url.searchParams.get("entityKey"));
  if (!et.success || !key.success) return jsonError(400, "entityType and entityKey required");
  return NextResponse.json({ versions: await listVersions(et.data, key.data) });
});
```

- [ ] **Step 6: Content blocks route** — `src/app/api/v1/admin/config/content-blocks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { slug, upsertBlockInput } from "@/lib/contracts/config";
import { jsonError, parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { getBlock, listBlocks, upsertBlock } from "@/services/content";

export const GET = withErrorMapping(async (req) => {
  await requireRole("editor");
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ blocks: await listBlocks() });
  const parsed = slug.safeParse(key);
  if (!parsed.success) return jsonError(400, "invalid key");
  return NextResponse.json({ block: await getBlock(parsed.data) });
});

export const PUT = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const input = await parseBody(req, upsertBlockInput);
  await upsertBlock(input, profile.username);
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 7: Verify**

- `npx tsc --noEmit` clean; `npm run build` succeeds; `npm run test` — 59 passing
- Functional smoke (signed-out → 401): start dev server, then:
  - `GET /api/v1/admin/config/options?namespace=nav` → 401 with `{"error":"Sign in required"}`
  - `PUT /api/v1/admin/config/options` with empty body → 401 (authz runs before validation)
  Stop the server. (Editor-path positive tests come via the admin UI e2e in Plan 2b; the service layer is already integration-tested.)

- [ ] **Step 8: Commit**

```
git add -A
git commit -m "feat: role-gated admin config API (options, reorder, publish, rollback, versions, blocks)"
```

---

### Task 8: Public config API + cached server helpers + close-out

**Files:**
- Create: `src/app/api/v1/config/[namespace]/route.ts`, `src/services/public-config.ts`
- Modify: `task-list.md`, `handoff.md`

- [ ] **Step 1: Cached server helpers** — `src/services/public-config.ts` (this is what RSCs — and Plan 2b's brand/nav wiring — import):

```ts
import "server-only";
import { unstable_cache } from "next/cache";
import { getPublishedOptions } from "./config";
import { getPublishedBlock } from "./content";
import type { PublishedBlock, PublishedOption } from "@/lib/contracts/config";

/**
 * Published options for a namespace, cached and tagged for revalidation on
 * publish. Returns [] when nothing is published — consumers MUST provide
 * their own safe defaults (build-guide rule).
 */
export async function publishedOptions(namespace: string): Promise<PublishedOption[]> {
  const cached = unstable_cache(
    async () => (await getPublishedOptions(namespace))?.options ?? [],
    ["published-options", namespace],
    { tags: [`config:options_namespace:${namespace}`] },
  );
  const options = await cached();
  return options.filter((o) => o.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Published content block, cached + tagged. Null when never published. */
export async function publishedBlock(key: string): Promise<PublishedBlock | null> {
  const cached = unstable_cache(
    async () => getPublishedBlock(key),
    ["published-block", key],
    { tags: [`config:content_block:${key}`] },
  );
  return cached();
}
```

NOTE: if the installed Next 16 deprecates `unstable_cache` in favor of `"use cache"` + `cacheTag()`, use the current documented mechanism — the contract is: cached read, tagged `config:<entityType>:<key>`, invalidated by the publish route's revalidation call. Verify the pairing actually works in Step 3.

- [ ] **Step 2: Public route** — `src/app/api/v1/config/[namespace]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { slug } from "@/lib/contracts/config";
import { jsonError } from "@/lib/api";
import { publishedOptions } from "@/services/public-config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ namespace: string }> },
) {
  const { namespace } = await params;
  const parsed = slug.safeParse(namespace);
  if (!parsed.success) return jsonError(400, "invalid namespace");
  const options = await publishedOptions(parsed.data);
  return NextResponse.json({ namespace: parsed.data, options });
}
```

- [ ] **Step 3: End-to-end verification of the publish→cache→read cycle**

With the dev server running and your admin user promoted (`npm run promote -- <your-username>`), drive the full cycle WITHOUT the UI using a temporary script `scripts/__cycle-check.mjs` that talks to the DB-layer services is not possible (server-only) — instead verify via HTTP + db: 

1. `GET /api/v1/config/smoke-ns` → 200 `{"namespace":"smoke-ns","options":[]}` (empty default, no error — build-guide fallback rule)
2. Seed + publish directly via a temporary node script using raw SQL (`scripts/__seed-smoke.mjs`, dotenv + neon): insert one row into config_options (namespace `smoke-ns`, key `probe`, label `Probe`, sort_order 0, enabled true, updated_by `script`), then insert into config_versions (entity_type `options_namespace`, entity_key `smoke-ns`, version 1, snapshot `[{"key":"probe","label":"Probe","value":null,"sortOrder":0,"enabled":true}]`, published_by `script`).
3. `GET /api/v1/config/smoke-ns` again — NOTE: because step 2 bypassed the publish route, the cache may still hold the empty result; restart the dev server (cold cache) and re-fetch → 200 with the `probe` option. This proves read-path correctness; tag revalidation is exercised in Plan 2b's UI e2e where publishing goes through the route.
4. Clean up: delete the smoke rows (config_options, config_versions, audit_log where entity_key='smoke-ns') in the same script run or a second one; DELETE both temp scripts; `git status` clean.

- [ ] **Step 4: Full gates**

`npm run test` (59) · `npm run test:e2e` (2) · `npm run build` · `npx tsc --noEmit` · `npm run lint` — all green.

- [ ] **Step 5: Tracking**

`task-list.md`: add under Plan 1's section:

```markdown
## Plan 2a: Config backend (docs/superpowers/plans/2026-06-13-plan2a-config-backend.md)
- [x] T1 Config schema + promote-admin script
- [x] T2 Zod contracts + server-only stub
- [x] T3 Options service CRUD + reorder
- [x] T4 Publish/versions/rollback
- [x] T5 Content blocks service
- [x] T6 Authz guard
- [x] T7 Admin API routes
- [x] T8 Public config API + cached helpers
```

(Replace the "## Plan 2: Config system + admin UI — not yet planned" line with this section plus a "## Plan 2b: Admin UI — not yet planned" line.)

`handoff.md`: append an entry — schema/services/APIs done, snapshot model explained in one line (working copy + published snapshots in config_versions; public reads = latest snapshot, cache-tagged `config:<entityType>:<key>`), promote script usage, pick up at Plan 2b (admin UI).

- [ ] **Step 6: Final commit**

```
git add -A
git commit -m "feat: public config API with tagged caching; close out Plan 2a"
```

---

## Plan Self-Review (completed)

- **Spec coverage (4.1 + API half of 5):** config_options ✓, content_blocks ✓, config_versions (generic entity snapshots) ✓, audit_log ✓, draft/publish ✓ (working copy + snapshots), version history + rollback ✓, role-gated CRUD ✓ (editor for edits, admin for rollback), server-side validation incl. empty-publish rejection ✓, public read-only API with cache tags + publish revalidation ✓, safe empty defaults ✓. Deferred to Plan 2b: admin UI, rich-text editing, config-driven brand/nav, UI e2e of the revalidation cycle.
- **Placeholders:** none.
- **Type consistency:** `PublishedOption`/`PublishedBlock` defined in Task 2, consumed in Tasks 4/5/8; `AuthzError` defined Task 6, mapped Task 7; `listVersions` defined Task 4, reused Task 5; cache tag format `config:<entityType>:<entityKey>` identical in Tasks 7 (publish) and 8 (helpers).
