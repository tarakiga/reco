import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { posterUrl } from "@/lib/tmdb/images";
import { BRAND_NAME } from "@/lib/brand";

// Downloadable poster with the user's rating (out of 10) stamped on the top-right.
const ACCENT = "#e63946";
const SURFACE = "#0b0d12";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const mediaType = sp.get("mediaType");
  const tmdbId = Number(sp.get("tmdbId"));
  const score = Number(sp.get("score")); // user's 1–5 star rating
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId)) {
    return new Response("Bad params", { status: 400 });
  }
  const out10 = Math.max(0, Math.min(10, Math.round((Number.isFinite(score) ? score : 0) * 2)));

  let posterData: string | null = null;
  let title = BRAND_NAME;
  try {
    const row = await getOrCreateTitle(mediaType, tmdbId);
    title = row.title;
    const purl = posterUrl(row.posterPath);
    if (purl) {
      const res = await fetch(purl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        posterData = `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    }
  } catch {
    /* fall back to a plain card */
  }

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: SURFACE, fontFamily: "sans-serif" }}>
        {posterData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterData} width={600} height={900} style={{ position: "absolute", top: 0, left: 0, width: 600, height: 900, objectFit: "cover" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600, height: 900, padding: 28 }}>
          {/* Rating badge, top-right */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 152,
                height: 152,
                borderRadius: 76,
                backgroundColor: "rgba(230,57,70,0.95)",
                border: "5px solid #ffffff",
                boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ display: "flex", fontSize: 80, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{out10}</div>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1, marginTop: 2 }}>/ 10</div>
            </div>
          </div>
          {/* Brand tag, bottom-left */}
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#fff", backgroundColor: "rgba(11,13,18,0.72)", borderRadius: 8, padding: "8px 16px" }}>
              {BRAND_NAME}
              <span style={{ color: ACCENT, display: "flex" }}>.</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 600, height: 900 },
  );

  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
  const fname = (title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "rating") + `-${out10}-of-10`;

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${fname}.jpg"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
