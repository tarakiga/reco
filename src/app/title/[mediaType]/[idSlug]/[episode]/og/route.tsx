import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { oneEpisode } from "@/services/tv-season";
import { parseIdSlug, parseEpisodeSlug } from "@/lib/tmdb/detail";
import { episodeCardFields } from "@/lib/tmdb/episode-card";
import { posterUrl } from "@/lib/tmdb/images";
import { BRAND_NAME } from "@/lib/brand";

const SIZE = { width: 1200, height: 630 };
const ACCENT = "#e63946";
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#cbd2dd";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mediaType: string; idSlug: string; episode: string }> },
) {
  const { mediaType, idSlug, episode: episodeSlug } = await params;
  const id = parseIdSlug(idSlug);
  const ref = parseEpisodeSlug(episodeSlug);

  let showTitle = BRAND_NAME;
  let episodeName = "";
  let metaLine = "";
  let yearLine = "";
  let synopsis: string | null = null;
  let posterSrc: string | null = null;

  if (id && ref && mediaType === "tv") {
    try {
      const show = await getOrCreateTitle("tv", id, false);
      const episode = await oneEpisode(id, ref.season, ref.episode);
      showTitle = show.title;
      posterSrc = posterUrl(show.posterPath);
      if (episode) {
        const fields = episodeCardFields({
          showYear: show.releaseYear,
          season: ref.season,
          episode: ref.episode,
          airDate: episode.airDate,
          overview: episode.overview,
        });
        episodeName = episode.name;
        metaLine = fields.metaLine;
        yearLine = fields.year ? String(fields.year) : "";
        synopsis = fields.synopsis;
      }
    } catch {
      /* fall back to the branded card */
    }
  }

  // Satori's own image fetch is flaky, which is why some cards came out blank.
  // Fetch it ourselves and inline it.
  let poster: string | null = null;
  if (posterSrc) {
    try {
      const res = await fetch(posterSrc);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        poster = `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
      }
    } catch {
      /* no poster, the text column still renders */
    }
  }

  const nameSize = episodeName.length > 40 ? 46 : episodeName.length > 24 ? 58 : 70;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: SURFACE,
          fontFamily: "sans-serif",
          padding: 56,
        }}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            width={346}
            height={518}
            style={{ width: 346, height: 518, borderRadius: 12, objectFit: "cover" }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            marginLeft: poster ? 48 : 0,
            height: 518,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: MUTED }}>{showTitle}</div>
            {metaLine ? (
              <div style={{ display: "flex", marginTop: 10, fontSize: 28, fontWeight: 700, color: ACCENT }}>
                {metaLine}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: nameSize,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: TEXT,
              }}
            >
              {episodeName}
            </div>
            {yearLine ? (
              <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: MUTED }}>{yearLine}</div>
            ) : null}
            {synopsis ? (
              <div style={{ display: "flex", marginTop: 20, fontSize: 24, lineHeight: 1.35, color: MUTED }}>
                {synopsis}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: TEXT }}>
            {BRAND_NAME}
            <span style={{ color: ACCENT, display: "flex" }}>.</span>
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  );

  // ImageResponse is PNG-only and a poster PNG is large enough that WhatsApp may
  // skip it. Re-encode as JPEG so the preview shows reliably.
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
