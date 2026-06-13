import { connection, NextResponse } from "next/server";
import { deleteOptionInput, slug, upsertOptionInput } from "@/lib/contracts/config";
import { jsonError, parseBody, withErrorMapping } from "@/lib/api";
import { requireRole } from "@/services/authz";
import { deleteOption, listOptions, upsertOption } from "@/services/config";

const _GET = withErrorMapping(async (req) => {
  await requireRole("editor");
  const ns = new URL(req.url).searchParams.get("namespace");
  const parsed = slug.safeParse(ns);
  if (!parsed.success) return jsonError(400, "namespace query param required");
  return NextResponse.json({ options: await listOptions(parsed.data) });
});

export async function GET(req: Request) {
  await connection();
  return _GET(req);
}

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
