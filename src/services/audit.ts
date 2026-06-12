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
