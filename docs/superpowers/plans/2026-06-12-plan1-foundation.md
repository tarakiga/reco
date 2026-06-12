# Plan 1: Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the reco Next.js app with design tokens, a Storybook-documented component library, Clerk auth, and a Neon/Drizzle database with profiles — a themed, authed app shell ready for the config system (Plan 2) and catalog (Plan 3).

**Architecture:** Single Next.js App Router app. All styling flows through Tailwind v4 `@theme` tokens (no raw hex/px outside `globals.css`). UI components live in `src/components/ui` with a Storybook story each. Clerk owns credentials/sessions; a local `profiles` table owns app identity (username, region, role) and is lazily created on first authed request.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind v4, Storybook, Vitest + Testing Library, Playwright, Clerk, Drizzle ORM, Neon Postgres.

**Spec:** `docs/superpowers/specs/2026-06-12-reco-v1-design.md`

**Conventions for every task:** run commands from the repo root `D:\work\Tar\PROJECTS\reco`. Commit after every task with the message given. If a test step says "Expected: FAIL", do not proceed until you have seen it fail.

---

### Task 1: Scaffold Next.js app

**Files:**
- Create: entire Next.js scaffold in repo root (`package.json`, `src/app/*`, etc.)

- [ ] **Step 1: Scaffold into the existing repo**

The repo already contains `docs/` and `.git/`. create-next-app refuses non-empty dirs, so scaffold into a temp dir and move the contents:

```powershell
npx create-next-app@latest reco-tmp --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm --yes
Get-ChildItem reco-tmp -Force | Where-Object { $_.Name -ne ".git" } | Move-Item -Destination .
Remove-Item reco-tmp -Recurse -Force
```

Expected: `package.json`, `src/app/`, `next.config.ts`, `tsconfig.json` now in repo root.

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` — open http://localhost:3000, expect the Next.js starter page. Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app (TS, App Router, Tailwind, src dir)"
```

---

### Task 2: Repo hygiene — env pattern, README, tracking files

**Files:**
- Create: `.env.example`, `README.md` (overwrite starter), `task-list.md`, `handoff.md`
- Verify: `.gitignore` ignores `.env*`

- [ ] **Step 1: Verify .gitignore covers env files**

Open `.gitignore`; confirm it contains `.env*` (create-next-app default). If not, append:

```
.env
.env.local
*.local.env
```

- [ ] **Step 2: Create `.env.example`** (tracked; placeholders only — never real values)

```
# --- Database (Neon Postgres) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"

# --- Auth (Clerk) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_REPLACE"
CLERK_SECRET_KEY="sk_test_REPLACE"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# --- Catalog data (used from Plan 3 onward) ---
TMDB_API_KEY=""

# --- File storage (used from Plan 3 onward) ---
CLOUDINARY_URL=""
```

- [ ] **Step 3: Overwrite `README.md`**

```markdown
# reco (working codename)

Community entertainment platform — catalog, watchlists, ratings; community and AI layers to follow.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Neon + Clerk values.
3. `npm run db:push` (after Plan 1 Task 13 exists)
4. `npm run dev`

## Docs
- Spec: `docs/superpowers/specs/2026-06-12-reco-v1-design.md`
- Plans: `docs/superpowers/plans/`
- Progress: `task-list.md`, `handoff.md`

## Commands
- `npm run dev` / `npm run build`
- `npm run test` (Vitest) / `npm run test:e2e` (Playwright)
- `npm run storybook`
```

- [ ] **Step 4: Create `task-list.md`**

```markdown
# reco — Task List

## Plan 1: Foundation (docs/superpowers/plans/2026-06-12-plan1-foundation.md)
- [ ] T1 Scaffold Next.js app
- [ ] T2 Repo hygiene (env, README, tracking)
- [ ] T3 Vitest + cn() helper
- [ ] T4 Design tokens
- [ ] T5 Storybook
- [ ] T6 Button
- [ ] T7 Input + Select
- [ ] T8 Badge + Skeleton + EmptyState
- [ ] T9 Tabs
- [ ] T10 Modal
- [ ] T11 Toast
- [ ] T12 PageShell + layout
- [ ] T13 Clerk auth
- [ ] T14 Drizzle + Neon + profiles schema
- [ ] T15 ensureProfile service
- [ ] T16 Playwright smoke tests

## Plan 2: Config system + admin UI — not yet planned
## Plan 3: Catalog MVP — not yet planned
```

- [ ] **Step 5: Create `handoff.md`**

```markdown
# reco — Handoff Log

Append an entry after each completed task: what was done, decisions made, where to pick up.

---
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: env pattern, README, task tracking files"
```

---

### Task 3: Vitest setup + `cn()` class helper (TDD)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/cn.ts`, `src/lib/cn.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dependencies**

```powershell
npm install clsx tailwind-merge
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write the failing test** — `src/lib/cn.test.ts`

```ts
import { cn } from "./cn";

test("merges class names", () => {
  expect(cn("a", "b")).toBe("a b");
});

test("drops falsy values", () => {
  expect(cn("a", false && "b", undefined)).toBe("a");
});

test("later tailwind classes win conflicts", () => {
  expect(cn("px-2", "px-4")).toBe("px-4");
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/lib/cn.test.ts`
Expected: FAIL — `Cannot find module './cn'`

- [ ] **Step 7: Implement** — `src/lib/cn.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/lib/cn.test.ts` — Expected: 3 passed

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: vitest setup and cn() class helper"
```

---

### Task 4: Design tokens (Tailwind v4 `@theme`)

**Files:**
- Modify: `src/app/globals.css` (replace entire contents)

- [ ] **Step 1: Replace `src/app/globals.css`**

This file is the ONLY place raw color/size values are allowed (build-guide rule). Dark-first cinema palette:

```css
@import "tailwindcss";

@theme {
  /* Color tokens — semantic, dark-first */
  --color-surface: #0b0d12;
  --color-surface-raised: #151821;
  --color-surface-overlay: #1d2130;
  --color-text: #f2f4f8;
  --color-text-muted: #9aa3b2;
  --color-border: #2a2f3e;
  --color-accent: #e63946;
  --color-accent-hover: #f25c67;
  --color-success: #2dd4a7;
  --color-warning: #f4b740;
  --color-danger: #ef4444;

  /* Typography */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-raised: 0 4px 16px rgb(0 0 0 / 0.4);
  --shadow-overlay: 0 12px 40px rgb(0 0 0 / 0.6);

  /* Breakpoints */
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
}

body {
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Replace starter home page** — `src/app/page.tsx` (temporary; PageShell integration comes in Task 12)

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold">reco</h1>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev` — page shows dark background (`#0b0d12`), light text. Stop server.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: design token layer (colors, type, radii, shadows, breakpoints)"
```

---

### Task 5: Storybook setup

**Files:**
- Create: `.storybook/main.ts`, `.storybook/preview.ts` (generated, then edited)

- [ ] **Step 1: Initialize Storybook**

```powershell
npx storybook@latest init --yes
```

Expected: `.storybook/` created, scripts `storybook` + `build-storybook` added. Delete the generated `src/stories/` examples folder:

```powershell
Remove-Item src/stories -Recurse -Force
```

- [ ] **Step 2: Edit `.storybook/preview.ts`** so stories render with our tokens and dark surface:

```ts
import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "surface",
      values: [{ name: "surface", value: "#0b0d12" }],
    },
  },
};

export default preview;
```

(If the generated preview imports from a different package name, e.g. `@storybook/react`, keep the generated import and only add the CSS import + backgrounds.)

- [ ] **Step 3: Verify**

Run: `npm run storybook` — Storybook opens with no stories (examples deleted), no build errors. Stop it.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "chore: storybook setup with token CSS and dark background"
```

---

### Task 6: Button component (TDD)

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Button.test.tsx`, `src/components/ui/Button.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/Button.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

test("renders children and handles click", async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onClick).toHaveBeenCalledOnce();
});

test("is disabled and announces busy when loading", () => {
  render(<Button loading>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
});

test("respects explicit disabled", () => {
  render(<Button disabled>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL — `Cannot find module './Button'`

- [ ] **Step 3: Implement** — `src/components/ui/Button.tsx`

```tsx
"use client";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text hover:bg-accent-hover",
  secondary:
    "bg-surface-raised text-text border border-border hover:bg-surface-overlay",
  ghost: "bg-transparent text-text-muted hover:text-text hover:bg-surface-raised",
  danger: "bg-danger text-text hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Button.test.tsx` — Expected: 3 passed

- [ ] **Step 5: Add story** — `src/components/ui/Button.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Button" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = { args: { variant: "danger" } };
export const Loading: Story = { args: { loading: true } };
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
```

(Note: if Storybook init generated imports from `@storybook/react`, use that module name in all story files instead of `@storybook/nextjs` — match whatever Task 5 generated.)

- [ ] **Step 6: Verify story renders**

Run: `npm run storybook` — Primitives/Button shows all variants. Stop it.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: Button component with variants, sizes, loading state"
```

---

### Task 7: Input + Select components (TDD)

**Files:**
- Create: `src/components/ui/Input.tsx`, `src/components/ui/Input.test.tsx`, `src/components/ui/Input.stories.tsx`
- Create: `src/components/ui/Select.tsx`, `src/components/ui/Select.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/Input.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

test("associates label with input", () => {
  render(<Input label="Username" />);
  expect(screen.getByLabelText("Username")).toBeInTheDocument();
});

test("shows error and marks input invalid", () => {
  render(<Input label="Username" error="Already taken" />);
  const input = screen.getByLabelText("Username");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Already taken")).toBeInTheDocument();
  expect(input).toHaveAccessibleDescription("Already taken");
});

test("shows hint when no error", () => {
  render(<Input label="Username" hint="3-20 characters" />);
  expect(screen.getByLabelText("Username")).toHaveAccessibleDescription("3-20 characters");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Input.test.tsx`
Expected: FAIL — `Cannot find module './Input'`

- [ ] **Step 3: Implement** — `src/components/ui/Input.tsx`

```tsx
"use client";
import { cn } from "@/lib/cn";
import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id: idProp, ...rest }: InputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-md border bg-surface-raised px-3 text-sm text-text",
          "placeholder:text-text-muted focus:outline-2 focus:outline-accent",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Input.test.tsx` — Expected: 3 passed

- [ ] **Step 5: Implement Select** (same label/error pattern, native `<select>`) — `src/components/ui/Select.tsx`

```tsx
"use client";
import { cn } from "@/lib/cn";
import { useId, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function Select({ label, error, className, id: idProp, children, ...rest }: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-10 rounded-md border bg-surface-raised px-3 text-sm text-text",
          "focus:outline-2 focus:outline-accent",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add stories** — `src/components/ui/Input.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { label: "Username", placeholder: "e.g. moviefan42" },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: "3-20 characters, letters and numbers" } };
export const WithError: Story = { args: { error: "That username is taken" } };
```

`src/components/ui/Select.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
  args: { label: "Region" },
  render: (args) => (
    <Select {...args}>
      <option value="US">United States</option>
      <option value="GB">United Kingdom</option>
      <option value="NG">Nigeria</option>
    </Select>
  ),
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithError: Story = { args: { error: "Please choose a region" } };
```

- [ ] **Step 7: Run full test suite, verify Storybook, commit**

Run: `npm run test` — Expected: all pass.

```powershell
git add -A
git commit -m "feat: Input and Select form components"
```

---

### Task 8: Badge, Skeleton, EmptyState (static display primitives)

**Files:**
- Create: `src/components/ui/Badge.tsx`, `src/components/ui/Skeleton.tsx`, `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/display.test.tsx`, `src/components/ui/Badge.stories.tsx`, `src/components/ui/Skeleton.stories.tsx`, `src/components/ui/EmptyState.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/display.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

test("Badge renders its label", () => {
  render(<Badge variant="success">Published</Badge>);
  expect(screen.getByText("Published")).toBeInTheDocument();
});

test("Skeleton is hidden from screen readers", () => {
  const { container } = render(<Skeleton className="h-4 w-32" />);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

test("EmptyState renders title, description, and action", () => {
  render(
    <EmptyState
      title="No results"
      description="Try a different search."
      action={<button>Clear filters</button>}
    />,
  );
  expect(screen.getByText("No results")).toBeInTheDocument();
  expect(screen.getByText("Try a different search.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/display.test.tsx`
Expected: FAIL — `Cannot find module './Badge'`

- [ ] **Step 3: Implement all three**

`src/components/ui/Badge.tsx`:

```tsx
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-overlay text-text-muted border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

`src/components/ui/Skeleton.tsx`:

```tsx
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-overlay", className)}
    />
  );
}
```

`src/components/ui/EmptyState.tsx`:

```tsx
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/display.test.tsx` — Expected: 3 passed

- [ ] **Step 5: Add stories** (one file per component)

`src/components/ui/Badge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = { title: "Primitives/Badge", component: Badge };
export default meta;
type Story = StoryObj<typeof Badge>;

export const All: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="neutral">Draft</Badge>
      <Badge variant="success">Published</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Disabled</Badge>
    </div>
  ),
};
```

`src/components/ui/Skeleton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = { title: "Primitives/Skeleton", component: Skeleton };
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const CardShape: Story = {
  render: () => (
    <div className="flex w-40 flex-col gap-2">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  ),
};
```

`src/components/ui/EmptyState.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta: Meta<typeof EmptyState> = { title: "Primitives/EmptyState", component: EmptyState };
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No streaming info for your region",
    description: "We could not find availability data for this title where you are.",
  },
};
export const WithAction: Story = {
  args: {
    title: "Your watchlist is empty",
    description: "Find something to watch and add it here.",
    action: <Button>Browse titles</Button>,
  },
};
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: Badge, Skeleton, EmptyState display primitives"
```

---

### Task 9: Tabs component (TDD)

**Files:**
- Create: `src/components/ui/Tabs.tsx`, `src/components/ui/Tabs.test.tsx`, `src/components/ui/Tabs.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/Tabs.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

const items = [
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV Shows" },
];

test("marks the active tab selected", () => {
  render(<Tabs items={items} value="tv" onChange={() => {}} />);
  expect(screen.getByRole("tab", { name: "TV Shows" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Movies" })).toHaveAttribute("aria-selected", "false");
});

test("calls onChange with the clicked tab id", async () => {
  const onChange = vi.fn();
  render(<Tabs items={items} value="movies" onChange={onChange} />);
  await userEvent.click(screen.getByRole("tab", { name: "TV Shows" }));
  expect(onChange).toHaveBeenCalledWith("tv");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Tabs.test.tsx`
Expected: FAIL — `Cannot find module './Tabs'`

- [ ] **Step 3: Implement** — `src/components/ui/Tabs.tsx`

```tsx
"use client";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Tabs.test.tsx` — Expected: 2 passed

- [ ] **Step 5: Add story** — `src/components/ui/Tabs.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = { title: "Primitives/Tabs", component: Tabs };
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState("movies");
    return (
      <Tabs
        items={[
          { id: "movies", label: "Movies" },
          { id: "tv", label: "TV Shows" },
          { id: "people", label: "People" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: Tabs component"
```

---

### Task 10: Modal component (TDD)

**Files:**
- Create: `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx`, `src/components/ui/Modal.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/Modal.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

test("renders nothing when closed", () => {
  render(
    <Modal open={false} onClose={() => {}} title="Confirm">
      Body
    </Modal>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("renders dialog with title when open", () => {
  render(
    <Modal open onClose={() => {}} title="Confirm">
      Body
    </Modal>,
  );
  expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
  expect(screen.getByText("Body")).toBeInTheDocument();
});

test("calls onClose on Escape", async () => {
  const onClose = vi.fn();
  render(
    <Modal open onClose={onClose} title="Confirm">
      Body
    </Modal>,
  );
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Modal.test.tsx`
Expected: FAIL — `Cannot find module './Modal'`

- [ ] **Step 3: Implement** — `src/components/ui/Modal.tsx`

```tsx
"use client";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-lg border border-border bg-surface-overlay p-6 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Modal.test.tsx` — Expected: 3 passed

- [ ] **Step 5: Add story** — `src/components/ui/Modal.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const meta: Meta<typeof Modal> = { title: "Primitives/Modal", component: Modal };
export default meta;
type Story = StoryObj<typeof Modal>;

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Remove from watchlist?">
          <p className="mb-4 text-sm text-text-muted">This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Remove
            </Button>
          </div>
        </Modal>
      </>
    );
  },
};
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: Modal component with escape and overlay close"
```

---

### Task 11: Toast system (TDD)

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/components/ui/Toast.test.tsx`, `src/components/ui/Toast.stories.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/ui/Toast.test.tsx`

```tsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast({ title: "Saved to watchlist", variant: "success" })}>
      Fire
    </button>
  );
}

test("shows a toast and auto-dismisses after 5s", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Fire" }));
  expect(screen.getByText("Saved to watchlist")).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(5100);
  });
  expect(screen.queryByText("Saved to watchlist")).not.toBeInTheDocument();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Toast.test.tsx`
Expected: FAIL — `Cannot find module './Toast'`

- [ ] **Step 3: Implement** — `src/components/ui/Toast.tsx`

```tsx
"use client";
import { cn } from "@/lib/cn";
import { createContext, useCallback, useContext, useState } from "react";

export type ToastVariant = "info" | "success" | "danger";

interface ToastInput {
  title: string;
  variant?: ToastVariant;
}

interface ToastItem extends Required<ToastInput> {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

const variantClasses: Record<ToastVariant, string> = {
  info: "border border-border bg-surface-overlay text-text",
  success: "bg-success text-surface",
  danger: "bg-danger text-text",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback(({ title, variant = "info" }: ToastInput) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, title, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-md px-4 py-3 text-sm font-medium shadow-raised",
              variantClasses[t.variant],
            )}
          >
            {t.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Toast.test.tsx` — Expected: 1 passed

- [ ] **Step 5: Add story** — `src/components/ui/Toast.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { ToastProvider, useToast } from "./Toast";
import { Button } from "./Button";

const meta: Meta<typeof ToastProvider> = { title: "Primitives/Toast", component: ToastProvider };
export default meta;
type Story = StoryObj<typeof ToastProvider>;

function Demo() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast({ title: "Something happened" })}>Info</Button>
      <Button onClick={() => toast({ title: "Saved to watchlist", variant: "success" })}>
        Success
      </Button>
      <Button onClick={() => toast({ title: "Something went wrong", variant: "danger" })}>
        Danger
      </Button>
    </div>
  );
}

export const Interactive: Story = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: Toast system with provider, hook, auto-dismiss"
```

---

### Task 12: PageShell layout + app integration

**Files:**
- Create: `src/components/layout/PageShell.tsx`, `src/components/layout/PageShell.stories.tsx`, `src/lib/brand.ts`, `src/lib/nav.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create interim brand + nav modules**

`src/lib/brand.ts` — single source for brand strings until the config system (Plan 2) replaces it:

```ts
// INTERIM: replaced by the config system (content_blocks) in Plan 2.
// Nothing else in the codebase may hardcode the product name.
export const BRAND_NAME = "reco";
```

`src/lib/nav.ts` — single source for nav links until config-driven (Plan 2):

```ts
// INTERIM: nav becomes config-driven in Plan 2.
export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
];
```

- [ ] **Step 2: Implement PageShell** — `src/components/layout/PageShell.tsx`

```tsx
import Link from "next/link";

export interface NavLink {
  href: string;
  label: string;
}

export function PageShell({
  brand,
  navLinks,
  actions,
  footer,
  children,
}: {
  brand: string;
  navLinks: NavLink[];
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-(--breakpoint-xl) items-center gap-8 px-4">
          <Link href="/" className="text-xl font-bold text-text">
            {brand}
          </Link>
          <nav className="flex flex-1 gap-1" aria-label="Primary">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-(--breakpoint-xl) flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-(--breakpoint-xl) px-4 py-6 text-sm text-text-muted">
          {footer}
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Add story** — `src/components/layout/PageShell.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { PageShell } from "./PageShell";
import { Button } from "../ui/Button";

const meta: Meta<typeof PageShell> = { title: "Layout/PageShell", component: PageShell };
export default meta;
type Story = StoryObj<typeof PageShell>;

export const Default: Story = {
  args: {
    brand: "reco",
    navLinks: [
      { href: "/", label: "Home" },
      { href: "/movies", label: "Movies" },
      { href: "/tv", label: "TV Shows" },
    ],
    actions: <Button size="sm">Sign in</Button>,
    footer: <span>Footer content (attribution lands here in Plan 3)</span>,
    children: <div className="text-text-muted">Page content goes here</div>,
  },
};
```

- [ ] **Step 4: Integrate into the app** — replace `src/app/layout.tsx` body markup (keep the generated font setup and metadata export, adjusting title):

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PageShell } from "@/components/layout/PageShell";
import { ToastProvider } from "@/components/ui/Toast";
import { BRAND_NAME } from "@/lib/brand";
import { NAV_LINKS } from "@/lib/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "Find what to watch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <ToastProvider>
          <PageShell brand={BRAND_NAME} navLinks={NAV_LINKS}>
            {children}
          </PageShell>
        </ToastProvider>
      </body>
    </html>
  );
}
```

Replace `src/app/page.tsx`:

```tsx
import { BRAND_NAME } from "@/lib/brand";

export default function Home() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold">{BRAND_NAME}</h1>
      <p className="mt-3 text-text-muted">Find what to watch. Catalog arrives in Plan 3.</p>
    </section>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run dev` — home page renders inside header/footer shell. Run `npm run test` — all pass. Stop server.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: PageShell layout integrated with brand and nav modules"
```

---

### Task 13: Clerk authentication

**Prerequisite (owner action):** a Clerk application must exist; put its keys in `.env.local`. The executor should pause and ask if keys are missing.

**Files:**
- Create: `src/middleware.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install**

```powershell
npm install @clerk/nextjs
```

- [ ] **Step 2: Create `src/middleware.ts`**

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 3: Wrap layout with ClerkProvider and add header auth actions**

In `src/app/layout.tsx`, add imports and wrap:

```tsx
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
```

The body becomes:

```tsx
<ClerkProvider>
  <html lang="en">
    <body className={`${geistSans.variable} antialiased`}>
      <ToastProvider>
        <PageShell
          brand={BRAND_NAME}
          navLinks={NAV_LINKS}
          actions={
            <>
              <SignedOut>
                <SignInButton mode="modal" />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          }
        >
          {children}
        </PageShell>
      </ToastProvider>
    </body>
  </html>
</ClerkProvider>
```

- [ ] **Step 4: Create dedicated auth pages**

`src/app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center py-16">
      <SignIn />
    </div>
  );
}
```

`src/app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex justify-center py-16">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev` — header shows "Sign in"; clicking opens the Clerk modal; completing sign-up shows the avatar UserButton. Stop server.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: Clerk auth with middleware, provider, sign-in/up pages"
```

---

### Task 14: Drizzle + Neon + profiles schema

**Prerequisite (owner action):** a Neon project must exist with `DATABASE_URL` in `.env.local` (create the database with the pgvector extension available; run `CREATE EXTENSION IF NOT EXISTS vector;` once in the Neon SQL editor — costs nothing now, used in Phase 3).

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/index.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install**

```powershell
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit dotenv
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Note: drizzle-kit reads `.env` by default, not `.env.local`. Add scripts that load it explicitly (Step 4).

- [ ] **Step 3: Create `src/db/schema.ts`**

```ts
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "editor", "admin"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatar_url"),
  region: text("region").notNull().default("US"),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
```

(The `region` column default is a safe fallback; the user-facing default region becomes a config value in Plan 2.)

- [ ] **Step 4: Create `src/db/index.ts` and scripts**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Add to `package.json` scripts (the `dotenv -e` style loader is not installed; use drizzle-kit's `--config` with env loaded via `dotenv/config` in the config file, and pass the env file by copying — simplest reliable approach on Windows is to keep `DATABASE_URL` in BOTH `.env.local` (for Next) and `.env` (for drizzle-kit), with `.env` gitignored):

```json
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 5: Push schema to Neon**

Run: `npm run db:push`
Expected: output ends with tables created (`profiles`), no errors.

- [ ] **Step 6: Verify with studio**

Run: `npm run db:studio` — opens a local UI showing the `profiles` table with all columns. Stop it.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: drizzle + neon setup with profiles schema"
```

---

### Task 15: Username generation + ensureProfile service (TDD)

**Files:**
- Create: `src/lib/username.ts`, `src/lib/username.test.ts`, `src/services/profile.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/username.test.ts`

```ts
import { usernameBase } from "./username";

test("derives base from email local part", () => {
  expect(usernameBase("Movie.Fan+42@example.com")).toBe("moviefan42");
});

test("strips non-alphanumerics and lowercases", () => {
  expect(usernameBase("Tár Wölf!")).toBe("trwlf");
});

test("pads short results", () => {
  expect(usernameBase("a@x.com")).toBe("usera");
});

test("truncates to 20 chars", () => {
  expect(usernameBase("abcdefghijklmnopqrstuvwxyz@x.com")).toBe("abcdefghijklmnopqrst");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/username.test.ts`
Expected: FAIL — `Cannot find module './username'`

- [ ] **Step 3: Implement** — `src/lib/username.ts`

```ts
export function usernameBase(input: string): string {
  const base = input
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `user${base}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/username.test.ts` — Expected: 4 passed

- [ ] **Step 5: Implement the profile service** — `src/services/profile.ts`

```ts
import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { usernameBase } from "@/lib/username";

/** Idempotently get-or-create the local profile row for a Clerk user. */
export async function ensureProfile(
  clerkUserId: string,
  emailOrName: string,
): Promise<Profile> {
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.clerkUserId, clerkUserId),
  });
  if (existing) return existing;

  const base = usernameBase(emailOrName);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    try {
      const [row] = await db
        .insert(profiles)
        .values({ clerkUserId, username: candidate })
        .returning();
      return row;
    } catch {
      // Unique violation: either username taken (try next suffix) or a
      // concurrent request already created this user's profile.
      const again = await db.query.profiles.findFirst({
        where: eq(profiles.clerkUserId, clerkUserId),
      });
      if (again) return again;
    }
  }
  throw new Error(`Could not allocate a username for ${clerkUserId}`);
}

/** Current request's profile, or null when signed out. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const seed =
    user?.primaryEmailAddress?.emailAddress ?? user?.username ?? userId;
  return ensureProfile(userId, seed);
}
```

```powershell
npm install server-only
```

- [ ] **Step 6: Wire a visible consumer** — show the username on the home page. Replace `src/app/page.tsx`:

```tsx
import { BRAND_NAME } from "@/lib/brand";
import { getCurrentProfile } from "@/services/profile";

export default async function Home() {
  const profile = await getCurrentProfile();
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold">{BRAND_NAME}</h1>
      <p className="mt-3 text-text-muted">
        {profile ? `Welcome back, ${profile.username}.` : "Find what to watch."}
      </p>
    </section>
  );
}
```

- [ ] **Step 7: Verify end-to-end**

Run: `npm run dev` — sign in; home page greets you by generated username. Check `npm run db:studio` — a `profiles` row exists. Run `npm run test` — all pass.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: profile service with username allocation, wired to home page"
```

---

### Task 16: Playwright smoke tests

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (script), `.gitignore`

- [ ] **Step 1: Install**

```powershell
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`.
Append to `.gitignore`:

```
/test-results/
/playwright-report/
```

- [ ] **Step 3: Create `e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("home renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("sign-in page renders the auth widget", async ({ page }) => {
  await page.goto("/sign-in");
  // Clerk renders a card with a heading; assert something stable:
  await expect(page.locator("form, .cl-rootBox").first()).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 4: Run e2e**

Run: `npm run test:e2e`
Expected: 2 passed (requires `.env.local` with Clerk keys; the dev server boots via webServer config).

- [ ] **Step 5: Update tracking files**

Mark Plan 1 tasks done in `task-list.md`; append a `handoff.md` entry summarizing: foundation complete, component library documented in Storybook, auth + profiles working, next is Plan 2 (config system + admin UI, to be planned).

- [ ] **Step 6: Final commit**

```powershell
git add -A
git commit -m "test: playwright smoke tests; close out Plan 1"
```

---

## Plan Self-Review (completed)

- **Spec coverage (foundation scope):** stack ✓, tokens-only styling ✓, component library + Storybook ✓, env hygiene ✓, Neon + Drizzle ✓, Clerk with role column ✓, tracking files ✓. Config system, catalog components (TitleCard, StarRating, Rail, ProviderLogoRow, FilterBar), and APIs intentionally deferred to Plans 2–3 where their consumers exist (YAGNI).
- **Placeholders:** none — every code step has complete code.
- **Type consistency:** `Profile` type defined in Task 14, consumed in Task 15; `cn` from Task 3 used throughout; story import note (Task 6) applies to all story files.
