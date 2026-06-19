import { NextResponse } from "next/server";
import { getSchedule } from "@/services/guide";
import { getPlutoSchedule } from "@/services/pluto";

// Pluto cold fetches fan out per channel; give the function room.
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const country = u.searchParams.get("country") ?? "US";
  const date = u.searchParams.get("date") ?? "";
  const channels = country.toUpperCase().startsWith("PLUTO_")
    ? await getPlutoSchedule(country.slice(6), date)
    : await getSchedule(country, date);
  return NextResponse.json({ channels });
}
