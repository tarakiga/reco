import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { parseIdSlug } from "@/lib/tmdb/detail";
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
  let backdropSrc: string | null = null;
  let metaLine = "";

  if (id && (mediaType === "movie" || mediaType === "tv")) {
    try {
      const row = await getOrCreateTitle(mediaType, id, false);
      const meta = (row.metadata ?? {}) as TmdbTitleDetail;
      title = row.title;
      backdropSrc = backdropUrl(row.backdropPath);
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

  // Fetch the backdrop ourselves and embed it — Satori's own image fetch is
  // flaky (which is why some cards came out blank).
  let backdrop: string | null = null;
  if (backdropSrc) {
    try {
      const res = await fetch(backdropSrc);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        backdrop = `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    } catch {
      /* no backdrop — branded fallback */
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
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        ) : null}

        {/* Foreground: flex column over the backdrop (Satori handles flex, not inset) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 1200,
            height: 630,
            padding: "48px 64px",
            backgroundImage:
              "linear-gradient(to top, rgba(11,13,18,0.96) 8%, rgba(11,13,18,0.22) 52%, rgba(11,13,18,0.72) 100%)",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: TEXT }}>
            {BRAND_NAME}
            <span style={{ color: ACCENT, display: "flex" }}>.</span>
          </div>

          {/* Title block (pinned to the bottom via space-between) */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, color: TEXT }}>
              {title}
            </div>
            {metaLine ? (
              <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: MUTED }}>{metaLine}</div>
            ) : null}
          </div>
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
