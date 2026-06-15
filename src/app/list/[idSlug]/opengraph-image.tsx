import { ImageResponse } from "next/og";
import { parseListId, getListMeta } from "@/services/lists";
import { BRAND_NAME } from "@/lib/brand";

// Per-list OG card with the list's title + subtitle (1200×630).
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const ACCENT = "#e63946";
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#9aa3b2";

export default async function Image({ params }: { params: { idSlug: string } }) {
  const id = parseListId(params.idSlug);
  const list = id ? await getListMeta(id) : null;
  const title = list?.title ?? BRAND_NAME;
  const subtitle = list?.subtitle ?? "Find what to watch.";
  const author = list?.author;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 90px",
          backgroundColor: SURFACE,
          backgroundImage: `radial-gradient(1100px 500px at 88% -10%, rgba(230,57,70,0.20), transparent), linear-gradient(135deg, #0b0d12 0%, #1d2130 100%)`,
          color: TEXT,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: MUTED }}>
          <div style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: ACCENT, display: "flex" }} />
          {author ? `A list by ${author}` : BRAND_NAME}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: title.length > 32 ? 78 : 104,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginTop: 26,
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div style={{ display: "flex", fontSize: 40, color: MUTED, marginTop: 22 }}>{subtitle}</div>
        )}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 30, fontWeight: 700, color: TEXT }}>
          {BRAND_NAME}
          <span style={{ color: ACCENT, display: "flex" }}>.</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
