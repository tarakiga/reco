import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { parseIdSlug, pickTrailerKey } from "@/lib/tmdb/detail";
import { backdropUrl } from "@/lib/tmdb/images";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { BRAND_NAME } from "@/lib/brand";

// Share card for a movie/TV page: the backdrop + a play button (when a trailer
// exists) so the link preview reads as a watchable trailer thumbnail everywhere
// (WhatsApp, iMessage, Discord, …), then a tap opens the page to actually play it.
const SIZE = { width: 1200, height: 630 };
const ACCENT = "#e63946";
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#cbd2dd";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mediaType: string; idSlug: string }> },
) {
  const { mediaType, idSlug } = await params;
  const id = parseIdSlug(idSlug);

  let title = BRAND_NAME;
  let backdrop: string | null = null;
  let metaLine = "";
  let hasTrailer = false;

  if (id && (mediaType === "movie" || mediaType === "tv")) {
    try {
      const row = await getOrCreateTitle(mediaType, id);
      const meta = (row.metadata ?? {}) as TmdbTitleDetail;
      title = row.title;
      backdrop = backdropUrl(row.backdropPath);
      hasTrailer = Boolean(pickTrailerKey(meta.videos?.results));
      const rating = meta.vote_average && meta.vote_average > 0 ? meta.vote_average.toFixed(1) : null;
      metaLine = [
        mediaType === "tv" ? "TV Series" : "Movie",
        row.releaseYear ? String(row.releaseYear) : null,
        rating ? `${rating} rating` : null,
      ]
        .filter(Boolean)
        .join("   ·   ");
    } catch {
      /* fall back to brand card */
    }
  }

  const titleSize = title.length > 40 ? 54 : title.length > 24 ? 70 : 90;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: SURFACE,
          fontFamily: "sans-serif",
        }}
      >
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            width={1200}
            height={630}
            style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        ) : null}

        {/* Legibility wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(to top, rgba(11,13,18,0.96) 8%, rgba(11,13,18,0.30) 55%, rgba(11,13,18,0.70) 100%)",
          }}
        />

        {/* Play button (only when a trailer exists) */}
        {hasTrailer && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 144,
                height: 144,
                borderRadius: 72,
                backgroundColor: "rgba(230,57,70,0.92)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
              }}
            >
              <svg width="58" height="66" viewBox="0 0 58 66">
                <polygon points="6,4 56,33 6,62" fill="#ffffff" />
              </svg>
            </div>
          </div>
        )}

        {/* Brand */}
        <div style={{ position: "absolute", top: 48, left: 64, display: "flex", fontSize: 30, fontWeight: 700, color: TEXT }}>
          {BRAND_NAME}
          <span style={{ color: ACCENT, display: "flex" }}>.</span>
        </div>

        {/* Title block */}
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 56, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, color: TEXT }}>
            {title}
          </div>
          {metaLine && (
            <div style={{ display: "flex", marginTop: 16, fontSize: 30, color: MUTED }}>{metaLine}</div>
          )}
          {hasTrailer && (
            <div style={{ display: "flex", marginTop: 8, fontSize: 26, fontWeight: 700, color: ACCENT }}>
              Watch the trailer
            </div>
          )}
        </div>
      </div>
    ),
    { ...SIZE },
  );

  // ImageResponse is PNG-only (~1MB+ for a photo backdrop, which WhatsApp may
  // skip). Re-encode as JPEG (~150-250KB) so the preview shows reliably.
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
