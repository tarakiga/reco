import { NextResponse } from "next/server";
import { slug } from "@/lib/contracts/config";
import { jsonError } from "@/lib/api";
import { publishedOptions } from "@/services/public-config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ namespace: string }> },
) {
  const { namespace } = await params;
  const parsed = slug.safeParse(namespace);
  if (!parsed.success) return jsonError(400, "invalid namespace");
  const options = await publishedOptions(parsed.data);
  return NextResponse.json({ namespace: parsed.data, options });
}
