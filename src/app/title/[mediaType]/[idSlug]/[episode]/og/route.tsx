import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getOrCreateTitle } from "@/services/catalog";
import { oneEpisode } from "@/services/tv-season";
import { TmdbError } from "@/lib/tmdb/client";
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

  // parseEpisodeSlug accepts s1-s999 and e1-e9999, an unbounded URL space far
  // bigger than any real season list, so a bogus link is cheap to construct
  // and cheap to spam. Refuse those before doing any lookup or rendering: the
  // page route already 404s for the same URL, and rendering an attractive
  // card for a 404 would let a bogus link look legitimate. Reject early so a
  // wave of made-up episode URLs cannot each force a TMDB call, a Satori
  // rasterise and a sharp JPEG encode.
  if (mediaType !== "tv") return new Response(null, { status: 404 });
  const id = parseIdSlug(idSlug);
  const ref = parseEpisodeSlug(episodeSlug);
  if (!id || !ref) return new Response(null, { status: 404 });

  let showTitle = BRAND_NAME;
  let episodeName = "";
  let metaLine = "";
  let yearLine = "";
  let synopsis: string | null = null;
  let posterSrc: string | null = null;

  try {
    const show = await getOrCreateTitle("tv", id, false);
    const episode = await oneEpisode(id, ref.season, ref.episode);
    // The episode genuinely does not exist: 404 rather than rasterise a card
    // for it, matching the page route's own 404 for this URL.
    if (!episode) return new Response(null, { status: 404 });
    showTitle = show.title;
    posterSrc = posterUrl(show.posterPath);
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
  } catch (e) {
    // A 404 from TMDB itself means the show or episode does not exist either.
    // Any other error is a transient fault on a real episode, which is better
    // served by the plain branded fallback card than by a broken preview.
    if (e instanceof TmdbError && e.status === 404) return new Response(null, { status: 404 });
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

  const nameSize =
    episodeName.length > 60 ? 38 : episodeName.length > 40 ? 46 : episodeName.length > 24 ? 58 : 70;

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
          <div style={{ display: "flex", width: 346, height: 518, borderRadius: 12, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} width={346} height={518} style={{ width: 346, height: 518, objectFit: "cover" }} />
          </div>
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
            {episodeName ? (
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
            ) : null}
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
