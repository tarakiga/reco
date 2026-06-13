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
  await new Promise((r) => setTimeout(r, 5));
  await writeAudit({ actor: "a", action: "x.two", entityType: "options_namespace", entityKey: KEY });
  const all = await listRecentAudit(500);
  const mine = all.filter((e) => e.entityKey === KEY);
  expect(mine.length).toBe(2);
  const idxTwo = all.findIndex((e) => e.action === "x.two" && e.entityKey === KEY);
  const idxOne = all.findIndex((e) => e.action === "x.one" && e.entityKey === KEY);
  expect(idxTwo).toBeLessThan(idxOne);
});
