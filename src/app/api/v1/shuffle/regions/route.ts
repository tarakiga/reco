import { NextResponse } from "next/server";
import { shuffleRegions } from "@/services/shuffle";

export async function GET() {
  return NextResponse.json({ regions: await shuffleRegions() });
}
