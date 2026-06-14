import { NextResponse } from "next/server";
import { regionProviders } from "@/services/shuffle";

export async function GET(req: Request) {
  const region = (new URL(req.url).searchParams.get("region") || "US").toUpperCase().slice(0, 2);
  return NextResponse.json({ providers: await regionProviders(region) });
}
