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
