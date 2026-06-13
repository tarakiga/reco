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
