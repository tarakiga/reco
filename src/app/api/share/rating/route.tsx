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
          {/* Rating badge, top-right: black rectangle, white border, star + bold N/10 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                backgroundColor: "rgba(0,0,0,0.82)",
                border: "3px solid #ffffff",
                borderRadius: 14,
                padding: "14px 22px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
              }}
            >
              <svg width="46" height="46" viewBox="0 0 24 24">
                <polygon
                  points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                  fill="#f4b740"
                />
              </svg>
              <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>
                {out10}/10
              </div>
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
