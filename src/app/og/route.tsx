import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

// Branded Open Graph card (1200×630), referenced as the site-wide default in the
// root layout metadata. Detail pages override it with their own poster/backdrop.
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const ACCENT = "#e63946";
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#9aa3b2";
const BORDER = "#2a2f3e";

export function GET() {
  const chips = ["Semantic scene search", "Personalised picks", "Where to watch"];
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <div style={{ width: 44, height: 6, borderRadius: 3, backgroundColor: ACCENT, display: "flex" }} />
          Movie &amp; TV discovery
        </div>

        <div style={{ display: "flex", alignItems: "baseline", marginTop: 28 }}>
          <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>
            {BRAND_NAME}
          </div>
          <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, color: ACCENT, display: "flex" }}>
            .
          </div>
        </div>

        <div style={{ fontSize: 54, fontWeight: 600, color: TEXT, marginTop: 18, display: "flex" }}>
          {BRAND_TAGLINE}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 56 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 28,
                color: MUTED,
                border: `2px solid ${BORDER}`,
                borderRadius: 999,
                padding: "12px 26px",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
