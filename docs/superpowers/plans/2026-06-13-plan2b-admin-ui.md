# Plan 2b: Config Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The role-gated admin UI on top of the Plan 2a config backend — manage option namespaces and content blocks with a draft/publish workflow, version history + rollback, an audit view — and make the app's brand + nav config-driven (replacing the interim hardcoded modules), all built from the existing component library.

**Architecture:** A server-rendered `/admin` section guarded by `requireRole("editor")` (redirects unauthorized users). Client islands fetch/mutate via React Query against the Plan 2a admin API; the public site reads published config via the cached `public-config` helpers. Rich text (content blocks) uses Tiptap, stored as HTML. Reordering uses accessible up/down buttons (no drag dependency). All UI composes existing primitives (Button, Input, Select, Modal, Tabs, Badge, Toast, EmptyState, Skeleton, PageShell) — new reusable pieces (AdminTable, AdminShell) go in the component library with stories.

**Tech Stack:** Next.js 16 (App Router, cacheComponents/PPR on), React Query, Tiptap, existing Tailwind v4 tokens + component library, Plan 2a services/API.

**Spec:** `docs/superpowers/specs/2026-06-12-reco-v1-design.md` section 5 (admin UI) + build-guide admin requirements.

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `plan-2b-admin-ui` (create from master at start). Commit after every task. TDD where logic is testable (client fetchers, transforms, seed); UI components get Storybook stories + a Playwright admin smoke at the end. Admin pages need an editor/admin session — drive e2e against a promoted test user via Clerk testing tokens OR assert the unauthorized redirect (see T9). `npm run promote -- <username>` grants roles. Never print env values. Never touch `D:\wamp64\www\rizmos`.

**Server/client boundary rule:** admin pages are Server Components that guard with `requireRole` then render Client Component islands for interactivity. Service modules are `server-only` — Client islands talk to the API via React Query, never import services directly.

---

### Task 1: React Query provider + typed admin API client

**Files:**
- Create: `src/components/providers/QueryProvider.tsx`, `src/lib/admin-client.ts`, `src/lib/admin-client.test.ts`
- Modify: `src/app/layout.tsx` (wrap with QueryProvider inside ToastProvider)
- Modify: `package.json` (@tanstack/react-query)

- [ ] **Step 1: Install**

```
npm install @tanstack/react-query
```

- [ ] **Step 2: QueryProvider** — `src/components/providers/QueryProvider.tsx`:

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Write the failing test** — `src/lib/admin-client.test.ts`:

```ts
import { vi, beforeEach } from "vitest";
import { adminFetch, AdminApiError } from "./admin-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

test("returns parsed json on ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, version: 3 }), { status: 200 })),
  );
  await expect(adminFetch("/api/v1/admin/config/publish", { method: "POST", body: {} })).resolves.toEqual({
    ok: true,
    version: 3,
  });
});

test("throws AdminApiError with status and message on error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "Requires admin role" }), { status: 403 })),
  );
  await expect(adminFetch("/x", { method: "POST", body: {} })).rejects.toMatchObject({
    status: 403,
    message: "Requires admin role",
  });
});

test("sends JSON body and header", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  await adminFetch("/y", { method: "PUT", body: { a: 1 } });
  const [, init] = spy.mock.calls[0];
  expect(init.method).toBe("PUT");
  expect(init.headers["Content-Type"]).toBe("application/json");
  expect(init.body).toBe(JSON.stringify({ a: 1 }));
});
```

- [ ] **Step 4: Run to verify failure** — `npx vitest run src/lib/admin-client.test.ts` → cannot resolve `./admin-client`.

- [ ] **Step 5: Implement** — `src/lib/admin-client.ts`:

```ts
export class AdminApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly issues?: unknown) {
    super(message);
  }
}

interface AdminFetchOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  body?: unknown;
}

export async function adminFetch<T = unknown>(url: string, opts: AdminFetchOptions = {}): Promise<T> {
  const init: RequestInit & { headers: Record<string, string> } = {
    method: opts.method ?? "GET",
    headers: {},
  };
  if (opts.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new AdminApiError(res.status, data.error ?? `Request failed (${res.status})`, data.issues);
  }
  return data as T;
}
```

- [ ] **Step 6: Wire QueryProvider** into `src/app/layout.tsx` — place it inside `ToastProvider`, wrapping `PageShell` (so admin client islands have both contexts). Keep ClerkProvider outermost. Verify the existing Suspense wrapper remains.

- [ ] **Step 7: Verify** — 3 admin-client tests pass; full suite 62; `npx tsc --noEmit` clean; `npm run build` succeeds.

- [ ] **Step 8: Commit**

```
git add -A
git commit -m "feat: react-query provider and typed admin api client"
```

---

### Task 2: Admin route guard + AdminShell layout

**Files:**
- Create: `src/components/layout/AdminShell.tsx`, `src/components/layout/AdminShell.stories.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/lib/admin-nav.ts`

- [ ] **Step 1: Admin nav constant** — `src/lib/admin-nav.ts`:

```ts
export const ADMIN_NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/options", label: "Options" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/audit", label: "Audit log" },
];
```

- [ ] **Step 2: AdminShell** — `src/components/layout/AdminShell.tsx` (presentational; sidebar nav + content area, token classes only):

```tsx
import Link from "next/link";

export interface AdminNavLink {
  href: string;
  label: string;
}

export function AdminShell({
  navLinks,
  children,
}: {
  navLinks: AdminNavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[12rem_1fr]">
      <aside className="md:border-r md:border-border md:pr-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Admin</p>
        <nav className="flex flex-col gap-1" aria-label="Admin">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
```

- [ ] **Step 3: Story** — `src/components/layout/AdminShell.stories.tsx` (title "Layout/AdminShell", Default with the 4 ADMIN_NAV-style links and placeholder children).

- [ ] **Step 4: Guarded admin layout** — `src/app/admin/layout.tsx` (Server Component; gate with requireRole, redirect unauthorized):

```tsx
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminShell } from "@/components/layout/AdminShell";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { requireRole, AuthzError } from "@/services/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  try {
    await requireRole("editor");
  } catch (err) {
    if (err instanceof AuthzError) redirect("/");
    throw err;
  }
  return <AdminShell navLinks={ADMIN_NAV}>{children}</AdminShell>;
}
```

NOTE: `connection()` opts this dynamic subtree out of prerender (consistent with Plan 2a admin routes under cacheComponents). Verify the redirect import path (`next/navigation`) is correct for Next 16. If `requireRole` returning the profile is useful later, ignore the return here.

- [ ] **Step 5: Overview page** — `src/app/admin/page.tsx`:

```tsx
export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Configuration</h1>
      <p className="mt-2 text-text-muted">
        Manage option lists and content blocks. Changes are drafts until you publish.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

- `npm run build` succeeds; `npm run test` 62; `npx tsc --noEmit` clean; `npm run lint` clean.
- Dev server (`npx next dev -p 3191`): signed-out `GET /admin` → 307/302 redirect to `/` (or renders `/` after redirect). Confirm it does NOT render admin content for anonymous users. Stop server.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: guarded admin layout and shell"
```

---

### Task 3: AdminTable component (TDD)

**Files:**
- Create: `src/components/ui/AdminTable.tsx`, `src/components/ui/AdminTable.test.tsx`, `src/components/ui/AdminTable.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/AdminTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AdminTable } from "./AdminTable";

interface Row { id: string; name: string; }
const rows: Row[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];

test("renders column headers and cell values", () => {
  render(
    <AdminTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { header: "Name", cell: (r) => r.name },
        { header: "ID", cell: (r) => r.id },
      ]}
    />,
  );
  expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

test("renders empty state when no rows", () => {
  render(
    <AdminTable
      rows={[]}
      rowKey={(r: Row) => r.id}
      columns={[{ header: "Name", cell: (r) => r.name }]}
      emptyLabel="Nothing here yet"
    />,
  );
  expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**, then implement — `src/components/ui/AdminTable.tsx`:

```tsx
import { cn } from "@/lib/cn";

export interface AdminTableColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  emptyLabel = "No items",
}: {
  rows: T[];
  columns: AdminTableColumn<T>[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-10 text-center text-sm text-text-muted">
        {emptyLabel}
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-text-muted">
          {columns.map((c) => (
            <th key={c.header} scope="col" className={cn("px-3 py-2 font-medium", c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-border/50">
            {columns.map((c) => (
              <td key={c.header} className={cn("px-3 py-2 text-text", c.className)}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Story** — `src/components/ui/AdminTable.stories.tsx` (title "Admin/AdminTable", a WithRows story and an Empty story).

- [ ] **Step 4: Verify** — 2 AdminTable tests pass; suite 64; tsc clean.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: AdminTable component"
```

---

### Task 4: Options management UI

**Files:**
- Create: `src/app/admin/options/page.tsx`, `src/components/admin/OptionsManager.tsx`, `src/components/admin/useConfigQueries.ts`

- [ ] **Step 1: Query/mutation hooks** — `src/components/admin/useConfigQueries.ts` (client; wraps adminFetch with React Query):

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-client";
import type { PublishedOption } from "@/lib/contracts/config";

interface OptionRow {
  id: string;
  namespace: string;
  key: string;
  label: string;
  value: unknown;
  sortOrder: number;
  enabled: boolean;
}

export function useOptions(namespace: string) {
  return useQuery({
    queryKey: ["options", namespace],
    queryFn: () =>
      adminFetch<{ options: OptionRow[] }>(
        `/api/v1/admin/config/options?namespace=${encodeURIComponent(namespace)}`,
      ).then((r) => r.options),
    enabled: namespace.length > 0,
  });
}

export function useUpsertOption(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      namespace: string;
      key: string;
      label: string;
      value?: unknown;
      sortOrder?: number;
      enabled?: boolean;
    }) => adminFetch("/api/v1/admin/config/options", { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}

export function useDeleteOption(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      adminFetch(
        `/api/v1/admin/config/options?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}

export function useReorderOptions(namespace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedKeys: string[]) =>
      adminFetch("/api/v1/admin/config/options/reorder", {
        method: "POST",
        body: { namespace, orderedKeys },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", namespace] }),
  });
}

export type { OptionRow, PublishedOption };
```

- [ ] **Step 2: OptionsManager client component** — `src/components/admin/OptionsManager.tsx`. Requirements (compose existing primitives, token classes only):
  - A namespace selector: a text Input to type a namespace + a "Load" button (namespaces are free-form; the spec's known starter namespace is "nav"). Default the input to "nav".
  - When loaded, render `AdminTable` of options with columns: drag-order (up/down Buttons calling `useReorderOptions` with the reordered key list), Key, Label, Enabled (Badge success/neutral + a toggle Button that upserts with flipped `enabled`), Actions (Edit button opens a Modal; Delete button opens a confirm Modal).
  - "Add option" Button opens the same Modal in create mode (fields: key, label, value-as-JSON optional textarea, enabled checkbox). On submit call `useUpsertOption`. Show validation errors from `AdminApiError.issues`/message via Toast.
  - A "Publish namespace" Button (calls the publish mutation — defer the actual publish hook to Task 5's PublishPanel which this page also renders; OR include a minimal publish call here and let Task 5 add history/rollback). To keep tasks clean: OptionsManager handles CRUD+reorder only; it renders `<PublishPanel entityType="options_namespace" entityKey={namespace} />` (built in Task 5) for publish/version/rollback. Import it; Task 5 creates it. If Task 5 not yet present during this task's isolated build, create a tiny placeholder `PublishPanel` that renders nothing, to be replaced in Task 5 — BUT prefer ordering: this task may stub it. Mark the stub clearly.
  - Loading → Skeletons; error → EmptyState with retry; empty namespace → AdminTable emptyLabel.
  - Use the Toast hook for success ("Saved", "Reordered", "Deleted") and errors.

  Because this is substantial UI, implement it cleanly with small sub-components in the same file if helpful (OptionRowActions, OptionFormModal). Keep it readable. Token classes only; no arbitrary values.

- [ ] **Step 3: Page** — `src/app/admin/options/page.tsx`:

```tsx
import { OptionsManager } from "@/components/admin/OptionsManager";

export default function AdminOptionsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Options</h1>
      <OptionsManager />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

- `npm run build` succeeds; `npm run test` (count unchanged — this task adds no unit tests, UI is exercised by the e2e in T9); `npx tsc --noEmit` clean; `npm run lint` clean.
- Manual: promote yourself (`npm run promote -- <username>`), dev server, sign in, visit `/admin/options`, load "nav", add an option, toggle enabled, reorder, edit, delete — confirm each works and toasts fire. (If you cannot sign in headlessly, at minimum confirm the page compiles, the guard redirects when signed out, and the components render without runtime error via the build + a signed-out redirect check. Report what you could and couldn't verify.)

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: options management admin UI (CRUD, reorder, enable toggle)"
```

---

### Task 5: PublishPanel — publish + version history + rollback

**Files:**
- Create: `src/components/admin/PublishPanel.tsx`, `src/components/admin/usePublishQueries.ts`
- Modify: `src/components/admin/OptionsManager.tsx` (replace any stub import with the real PublishPanel)

- [ ] **Step 1: Hooks** — `src/components/admin/usePublishQueries.ts`:

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/admin-client";

type EntityType = "options_namespace" | "content_block";

interface VersionRow {
  version: number;
  publishedBy: string;
  publishedAt: string;
}

export function useVersions(entityType: EntityType, entityKey: string) {
  return useQuery({
    queryKey: ["versions", entityType, entityKey],
    queryFn: () =>
      adminFetch<{ versions: VersionRow[] }>(
        `/api/v1/admin/config/versions?entityType=${entityType}&entityKey=${encodeURIComponent(entityKey)}`,
      ).then((r) => r.versions),
    enabled: entityKey.length > 0,
  });
}

export function usePublish(entityType: EntityType, entityKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      adminFetch<{ version: number }>("/api/v1/admin/config/publish", {
        method: "POST",
        body: { entityType, entityKey },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["versions", entityType, entityKey] }),
  });
}

export function useRollback(entityType: EntityType, entityKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) =>
      adminFetch("/api/v1/admin/config/rollback", {
        method: "POST",
        body: { entityType, entityKey, version },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["versions", entityType, entityKey] });
      qc.invalidateQueries({ queryKey: ["options", entityKey] });
      qc.invalidateQueries({ queryKey: ["block", entityKey] });
    },
  });
}

export type { EntityType, VersionRow };
```

- [ ] **Step 2: PublishPanel** — `src/components/admin/PublishPanel.tsx` (props: `entityType`, `entityKey`, optional `canRollback` boolean defaulting from a passed-in role prop). Requirements:
  - "Publish" Button → `usePublish().mutate()`; success Toast "Published v{n}"; error Toast (e.g. 422 "Cannot publish empty namespace").
  - Version history via `useVersions` rendered in an `AdminTable` (columns: Version, Published by, Published at (format the ISO string), Actions).
  - Rollback Button per version (only shown when `canRollback`) → opens confirm Modal → `useRollback().mutate(version)`; success Toast "Rolled back to v{n} (now a draft — publish to go live)". Rollback requires admin (API enforces; UI hides the button for non-admins via `canRollback`).
  - Loading/empty/error states via Skeleton/EmptyState/Toast.
  - Token classes only.

- [ ] **Step 3: Wire into OptionsManager** — ensure `OptionsManager` renders `<PublishPanel entityType="options_namespace" entityKey={namespace} canRollback={isAdmin} />`. The page (Server Component) must pass whether the current user is admin: have `src/app/admin/options/page.tsx` call `requireRole("editor")` returning the profile, compute `isAdmin = profile.role === "admin"`, and pass it down to `OptionsManager` → `PublishPanel`. Adjust OptionsManager props to accept `isAdmin: boolean`.

- [ ] **Step 4: Verify** — `npm run build` succeeds; tsc clean; lint clean; tests unchanged green. Manual/e2e deferred to T9.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: publish panel with version history and rollback"
```

---

### Task 6: Content blocks UI with Tiptap rich-text editor

**Files:**
- Create: `src/app/admin/content/page.tsx`, `src/components/admin/ContentManager.tsx`, `src/components/admin/RichTextEditor.tsx`, `src/components/admin/useContentQueries.ts`
- Modify: `package.json` (Tiptap)

- [ ] **Step 1: Install Tiptap**

```
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm
```

- [ ] **Step 2: RichTextEditor** — `src/components/admin/RichTextEditor.tsx` (client; controlled HTML value):

```tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "min-h-40 rounded-md border border-border bg-surface-raised p-3 text-sm text-text focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const toolBtn = (active: boolean) => cn("h-8 px-2 text-xs", active && "bg-surface-overlay");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <Button type="button" variant="ghost" className={toolBtn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</Button>
        <Button type="button" variant="ghost" className={toolBtn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</Button>
        <Button type="button" variant="ghost" className={toolBtn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
        <Button type="button" variant="ghost" className={toolBtn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>List</Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

NOTE: `immediatelyRender: false` is required for Next SSR to avoid hydration mismatch. Verify the installed Tiptap version's API (`useEditor`, `editor.commands.setContent` signature) — adapt the setContent call if the version's signature differs (older versions: `setContent(value, false)`). Tiptap stories/tests run in the storybook browser project; do not add a jsdom unit test for the editor (canvas/contenteditable doesn't work in jsdom) — it's covered by the content e2e and manual check.

- [ ] **Step 3: Content hooks** — `src/components/admin/useContentQueries.ts` (useBlocks list, useBlock(key), useUpsertBlock). Mirror useConfigQueries patterns against `/api/v1/admin/config/content-blocks`. Invalidate `["blocks"]` and `["block", key]` on upsert.

- [ ] **Step 4: ContentManager** — `src/components/admin/ContentManager.tsx`:
  - AdminTable of blocks (columns: Key, Title, Updated, Actions: Edit).
  - "New block" + Edit open a Modal with: key Input (disabled when editing), title Input, RichTextEditor for body. Save → useUpsertBlock. Toasts.
  - Renders `<PublishPanel entityType="content_block" entityKey={selectedKey} canRollback={isAdmin} />` for the selected/edited block.
  - Accepts `isAdmin` prop.

- [ ] **Step 5: Page** — `src/app/admin/content/page.tsx` (Server Component; requireRole editor, compute isAdmin, render `<ContentManager isAdmin={...} />` under an h1).

- [ ] **Step 6: Verify** — `npm run build` succeeds; tsc clean; lint clean; tests green; storybook builds (the editor renders). Manual/e2e in T9.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: content blocks admin UI with Tiptap rich-text editor"
```

---

### Task 7: Audit log view

**Files:**
- Create: `src/app/admin/audit/page.tsx`, `src/services/audit-read.ts`, `src/services/audit-read.test.ts`

- [ ] **Step 1: Write the failing test** — `src/services/audit-read.test.ts` (live-db; insert a couple audit rows under a `__vitest__audit<ts>` entityKey, read them back, assert descending by createdAt + limit; cleanup):

```ts
import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "./audit";
import { listRecentAudit } from "./audit-read";

const KEY = `__vitest__audit${Date.now()}`;

async function cleanup() {
  await db.delete(auditLog).where(eq(auditLog.entityKey, KEY));
}
beforeAll(cleanup);
afterAll(cleanup);

test("listRecentAudit returns most-recent first and respects limit", async () => {
  await writeAudit({ actor: "a", action: "x.one", entityType: "options_namespace", entityKey: KEY });
  await writeAudit({ actor: "a", action: "x.two", entityType: "options_namespace", entityKey: KEY });
  const all = await listRecentAudit(500);
  const mine = all.filter((e) => e.entityKey === KEY);
  expect(mine.length).toBe(2);
  // most recent first overall ordering
  const idxTwo = all.findIndex((e) => e.action === "x.two" && e.entityKey === KEY);
  const idxOne = all.findIndex((e) => e.action === "x.one" && e.entityKey === KEY);
  expect(idxTwo).toBeLessThan(idxOne);
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/services/audit-read.ts`:

```ts
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function listRecentAudit(limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}
```

- [ ] **Step 3: Audit page** — `src/app/admin/audit/page.tsx` (Server Component; requireRole editor; reads `listRecentAudit(100)` directly server-side — no client island needed — and renders an AdminTable of actor/action/entityType/entityKey/createdAt. Format timestamps. This is a server-rendered table, so import AdminTable (it's a server-compatible component — no "use client") and pass rows. If AdminTable can't be used from a Server Component because of any client-only dependency, render a plain server table instead; AdminTable as written has no client hooks so it should work server-side.):

- [ ] **Step 4: Verify** — audit-read test passes; suite +1; build/tsc/lint green; signed-out `/admin/audit` redirects.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: audit log view"
```

---

### Task 8: Config-driven brand + nav (replace interim modules)

**Files:**
- Create: `src/services/site-config.ts`, `src/services/site-config.test.ts`, `scripts/seed-site-config.mjs`
- Modify: `src/app/layout.tsx` (read brand/nav from config with safe fallback), `src/lib/brand.ts` + `src/lib/nav.ts` (become fallback defaults, clearly labeled)

- [ ] **Step 1: Site-config reader** — `src/services/site-config.ts` (uses the cached `publishedOptions`/`publishedBlock` from public-config; falls back to the interim defaults when unpublished — build-guide safe-default rule):

```ts
import "server-only";
import { publishedOptions, publishedBlock } from "./public-config";
import { BRAND_NAME as FALLBACK_BRAND } from "@/lib/brand";
import { NAV_LINKS as FALLBACK_NAV } from "@/lib/nav";

export interface SiteNavLink { href: string; label: string; }

/** Brand name from the "brand" content block, else the interim fallback. */
export async function getBrandName(): Promise<string> {
  const block = await publishedBlock("brand");
  const text = block?.body?.replace(/<[^>]+>/g, "").trim();
  return text && text.length > 0 ? text : FALLBACK_BRAND;
}

/** Nav links from the "nav" options namespace, else the interim fallback.
 *  Each option's value is { href, label }; key is ignored for display. */
export async function getNavLinks(): Promise<SiteNavLink[]> {
  const opts = await publishedOptions("nav");
  const links = opts
    .map((o) => o.value as Partial<SiteNavLink> | null)
    .filter((v): v is SiteNavLink => !!v && typeof v.href === "string" && typeof v.label === "string");
  return links.length > 0 ? links : FALLBACK_NAV;
}
```

- [ ] **Step 2: Write the failing test** — `src/services/site-config.test.ts`. Pure-ish: test the HTML-stripping/fallback logic by seeding+publishing a "nav" namespace and "brand" block via the services in a `__vitest__`-guarded way is heavy; instead test the transformation by mocking publishedOptions/publishedBlock. Use vitest `vi.mock`:

```ts
import { vi, beforeEach } from "vitest";

vi.mock("./public-config", () => ({
  publishedOptions: vi.fn(),
  publishedBlock: vi.fn(),
}));

import { publishedOptions, publishedBlock } from "./public-config";
import { getBrandName, getNavLinks } from "./site-config";

beforeEach(() => vi.clearAllMocks());

test("brand falls back when no block", async () => {
  (publishedBlock as any).mockResolvedValue(null);
  expect(await getBrandName()).toBe("reco");
});

test("brand strips html and uses block body", async () => {
  (publishedBlock as any).mockResolvedValue({ key: "brand", title: "Brand", body: "<p>Reelium</p>" });
  expect(await getBrandName()).toBe("Reelium");
});

test("nav falls back when namespace empty", async () => {
  (publishedOptions as any).mockResolvedValue([]);
  const nav = await getNavLinks();
  expect(nav).toEqual([{ href: "/", label: "Home" }]);
});

test("nav maps published option values", async () => {
  (publishedOptions as any).mockResolvedValue([
    { key: "home", label: "Home", value: { href: "/", label: "Home" }, sortOrder: 0, enabled: true },
    { key: "movies", label: "Movies", value: { href: "/movies", label: "Movies" }, sortOrder: 1, enabled: true },
  ]);
  expect(await getNavLinks()).toEqual([
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
  ]);
});
```

NOTE: `@/lib/brand` must export `BRAND_NAME = "reco"` and `@/lib/nav` `NAV_LINKS = [{href:"/",label:"Home"}]` — verify those interim values; the fallback tests assert them. The `vi.mock` of `./public-config` avoids hitting the cache/db.

- [ ] **Step 3: Run to verify failure**, then implement site-config.ts (Step 1). Get tests green.

- [ ] **Step 4: Wire into layout** — `src/app/layout.tsx`: replace `BRAND_NAME`/`NAV_LINKS` direct usage with `await getBrandName()` / `await getNavLinks()`. RootLayout is already async-compatible (Server Component). Keep the `<Suspense>` wrapper. Update `src/lib/brand.ts` and `src/lib/nav.ts` comments to say "Fallback default when config system has no published brand/nav (consumed by site-config.ts)."

- [ ] **Step 5: Seed script** — `scripts/seed-site-config.mjs` (dotenv + neon raw SQL): upserts the "nav" namespace options (home/movies/tv with {href,label} values) and publishes v1; upserts a "brand" content block and publishes v1. Idempotent (ON CONFLICT). Add `"seed:site": "node scripts/seed-site-config.mjs"` to package.json scripts. This lets the owner populate initial config; do NOT auto-run it in tests.

- [ ] **Step 6: Verify**

- site-config tests pass (4); full suite green; tsc/lint/build clean.
- Dev server: `/` still renders header with brand "reco" + Home nav (fallback path, since nothing published in this DB unless seeded). Optionally run `npm run seed:site` then confirm `/` shows seeded nav (home/movies/tv) and brand — then decide whether to leave seeded data or clean it (leave it; it's real initial config). Report what you did.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: config-driven brand and nav with safe fallbacks"
```

---

### Task 9: Admin e2e smoke + Plan 2b close-out

**Files:**
- Create: `e2e/admin.spec.ts`
- Modify: `task-list.md`, `handoff.md`

- [ ] **Step 1: Admin e2e** — `e2e/admin.spec.ts`. Without a programmatic Clerk session, assert the guard (the high-value, deterministic check):

```ts
import { test, expect } from "@playwright/test";

test("admin is gated for anonymous users", async ({ page }) => {
  await page.goto("/admin");
  // guard redirects to home; admin sidebar must NOT be present
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
});

test("admin options page is gated for anonymous users", async ({ page }) => {
  await page.goto("/admin/options");
  await expect(page).toHaveURL(/\/$/);
});
```

NOTE: if Clerk testing tokens are configured (CLERK keys + a test user), a fuller signed-in flow could be added, but the anonymous-guard assertion is the reliable baseline and proves the security boundary. Document this limitation in handoff.

- [ ] **Step 2: Run e2e** — `npm run test:e2e` → expect 4 passing (2 prior smoke + 2 admin guard). The webServer boots dev automatically.

- [ ] **Step 3: Full gates** — `npm run test` · `npm run test:e2e` · `npm run build` · `npx tsc --noEmit` · `npm run lint` all green. Clean `.next` before the final build if any stale dev-types linger.

- [ ] **Step 4: Tracking** — `task-list.md`: replace `## Plan 2b: Admin UI — not yet planned` with a checked T1–T9 list under a `## Plan 2b: Admin UI (docs/.../2026-06-13-plan2b-admin-ui.md)` heading. `handoff.md`: dated entry — admin UI complete (guarded /admin, options CRUD+reorder+publish/version/rollback, content blocks w/ Tiptap, audit view, config-driven brand/nav with fallbacks + `npm run seed:site`), note the e2e covers the anonymous guard (signed-in admin flow is manual/future), Plan 2 DONE; next is Plan 3 (catalog).

- [ ] **Step 5: Final commit**

```
git add -A
git commit -m "test: admin guard e2e; close out Plan 2b"
```

---

## Plan Self-Review (completed)

- **Spec coverage (section 5 admin UI + build-guide admin reqs):** role-gated admin UI ✓ (T2 guard), add/edit/disable/reorder options ✓ (T4), rich-text content editing ✓ (T6 Tiptap), draft/publish workflow ✓ (T5 PublishPanel — drafts are working copy, publish snapshots), version history + rollback ✓ (T5), editor attribution + timestamps ✓ (audit view T7 + version rows show publishedBy/At), config consumed dynamically by frontend ✓ (T8 brand/nav), safe defaults when unpopulated ✓ (T8 fallbacks). React Query ✓ (T1). Component-library-first ✓ (AdminTable/AdminShell + reuse of existing primitives, stories). Preview/draft state: drafts are inherently unpublished working copy — visible in admin, invisible publicly until publish (satisfies "preview changes in a draft state before publishing").
- **Deferred/limitations (documented):** signed-in admin e2e needs Clerk testing tokens — T9 asserts the anonymous guard instead; reorder uses up/down buttons not drag-drop (accessible, lean); the "preview" is the admin view of unpublished working copy rather than a separate rendered preview pane.
- **Placeholders:** none — every code-bearing step has concrete code; UI-heavy steps (T4/T6 managers) give explicit requirements + which primitives to compose, which is appropriate for composite screens.
- **Type/seam consistency:** adminFetch/AdminApiError (T1) used by all hooks (T4/T5/T6); PublishPanel (T5) consumed by OptionsManager (T4) and ContentManager (T6) — T4 notes the stub-then-replace ordering; cache tags from Plan 2a (`config:<entityType>:<key>`) are what publish invalidates so admin publishes refresh the public site; `isAdmin` prop threaded page→manager→PublishPanel for rollback gating (UI mirror of the API's admin requirement).
