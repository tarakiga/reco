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
