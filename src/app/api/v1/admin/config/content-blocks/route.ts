import { connection, NextResponse } from "next/server";
import { slug, upsertBlockInput } from "@/lib/contracts/config";
import { jsonError, parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { getBlock, listBlocks, upsertBlock } from "@/services/content";

const _GET = withErrorMapping(async (req) => {
  await requireRole("editor");
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ blocks: await listBlocks() });
  const parsed = slug.safeParse(key);
  if (!parsed.success) return jsonError(400, "invalid key");
  return NextResponse.json({ block: await getBlock(parsed.data) });
});

export async function GET(req: Request) {
  await connection();
  return _GET(req);
}

export const PUT = withErrorMapping(async (req) => {
  const profile = await requireRole("editor");
  const input = await parseBody(req, upsertBlockInput);
  await upsertBlock(input, profile.username);
  return NextResponse.json({ ok: true });
});
