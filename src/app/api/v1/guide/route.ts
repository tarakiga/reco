import { NextResponse } from "next/server";
import { getSchedule } from "@/services/guide";
import { getPlutoSchedule } from "@/services/pluto";
import { getPlexSchedule } from "@/services/plex";
import { getXumoSchedule } from "@/services/xumo";
import { getUktvSchedule } from "@/services/uktv";

// Streaming cold fetches fan out per channel; give the function room.
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const country = u.searchParams.get("country") ?? "US";
  const date = u.searchParams.get("date") ?? "";
  const cc = country.toUpperCase();

  let channels;
  if (cc === "XUMO") channels = await getXumoSchedule(date);
  else if (cc === "UKTV") channels = await getUktvSchedule(date);
  else if (cc.startsWith("PLEX_")) channels = await getPlexSchedule(country.slice(5), date);
  else if (cc.startsWith("PLUTO_")) channels = await getPlutoSchedule(country.slice(6), date);
  else channels = await getSchedule(country, date);

  return NextResponse.json({ channels });
}
