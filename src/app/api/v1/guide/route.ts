import { NextResponse } from "next/server";
import { getSchedule } from "@/services/guide";

// Cold fetches hit TVmaze (a single upstream call); give it a little room.
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const country = u.searchParams.get("country") ?? "US";
  const date = u.searchParams.get("date") ?? "";
  const channels = await getSchedule(country, date);
  return NextResponse.json({ channels });
}
