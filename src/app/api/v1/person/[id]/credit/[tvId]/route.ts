import { NextResponse } from "next/server";
import { getPersonShowCredit } from "@/services/person-credit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; tvId: string }> },
) {
  const { id, tvId } = await params;
  const personId = Number(id);
  const showId = Number(tvId);
  if (!Number.isInteger(personId) || !Number.isInteger(showId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getPersonShowCredit(personId, showId));
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
