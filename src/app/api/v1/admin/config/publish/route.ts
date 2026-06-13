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
  revalidateTag(`config:${input.entityType}:${input.entityKey}`, "default");
  return NextResponse.json({ ok: true, version });
});
