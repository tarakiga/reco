import { ImageResponse } from "next/og";
import { parseListId, getListForView, getListForOwner } from "@/services/lists";
import { getCurrentProfile } from "@/services/profile";
import { TIERS, TIER_COLOR, type Tier } from "@/lib/lists/tiers";

// Downloadable PNG of a tier list — coloured S/A/B/C bands with poster strips.
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#9aa3b2";
const UNRANKED = "#39414f";
// Poster grid geometry — posters wrap across rows so a tier never crops.
const WIDTH = 1200;
const PAD = 40;
const LABEL_W = 104;
const LABEL_GAP = 16;
const POSTER_W = 86;
const POSTER_H = 128;
const GAP = 8;
const POSTERS_W = WIDTH - PAD * 2 - LABEL_W - LABEL_GAP;
const COLS = Math.max(1, Math.floor((POSTERS_W + GAP) / (POSTER_W + GAP)));

export async function GET(req: Request, { params }: { params: Promise<{ idSlug: string }> }) {
  const { idSlug } = await params;
  const format = new URL(req.url).searchParams.get("format");
  const id = parseListId(idSlug);
  // Published lists export for anyone; the owner can also export their own draft.
  const pub = id ? await getListForView(id) : null;
  type ExportList = {
    title: string;
    author: string;
    showAuthor: boolean;
    tiered: boolean;
    items: { posterUrl: string | null; tier: Tier | null }[];
  };
  let list: ExportList | null = pub
    ? { title: pub.title, author: pub.author, showAuthor: pub.showAuthor, tiered: pub.tiered, items: pub.items }
    : null;
  if (!list && id) {
    const profile = await getCurrentProfile();
    if (profile) {
      const owned = await getListForOwner(profile.id, id);
      if (owned) {
        list = { title: owned.title, author: profile.username ?? "you", showAuthor: owned.showAuthor, tiered: owned.tiered, items: owned.items };
      }
    }
  }
  if (!list || !list.tiered) return new Response("Not a tier list", { status: 404 });

  const groups = [
    ...TIERS.map((t) => ({ tier: t as Tier | null, items: list.items.filter((i) => i.tier === t) })),
    { tier: null as Tier | null, items: list.items.filter((i) => !i.tier) },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const rows = Math.max(1, Math.ceil(g.items.length / COLS));
      // Visual extent of the wrapped poster block (label matches this height);
      // slot adds the trailing row gap so the canvas never clips a tier.
      const visualH = rows * POSTER_H + (rows - 1) * GAP;
      return { ...g, visualH, slotH: rows * (POSTER_H + GAP) };
    });

  // Post-image variant — fixed 1200×900 (4:3), for a Reddit/forum image post.
  // Posters shrink to a size where EVERY title fits (wrapping within each tier),
  // so nothing is cropped. Footer credits the name (left) and address (right).
  if (format === "banner") {
    const BW = 1200;
    const BH = 900;
    const BPAD = 36;
    const RGAP = 12;
    const BGAP = 8;
    const labelW = 80;
    const titleH = list.showAuthor ? 72 : 50;
    const footerH = 40;
    const n = groups.length;
    const usableH = BH - BPAD * 2 - titleH - footerH - 22;
    const areaW = BW - BPAD * 2 - labelW - 16;

    // For a poster width, lay every tier out wrapped and measure total height.
    // blockH includes the trailing row gap so it matches the rendered DOM.
    const layoutFor = (pw: number) => {
      const ph = Math.round(pw * 1.5);
      const cols = Math.max(1, Math.floor((areaW + BGAP) / (pw + BGAP)));
      const blocks = groups.map((g) => Math.max(1, Math.ceil(g.items.length / cols)) * (ph + BGAP));
      const total = blocks.reduce((a, h) => a + h, 0) + RGAP * (n - 1);
      return { pw, ph, blocks, total };
    };
    // Largest poster width (capped) at which everything fits the fixed height.
    let L = layoutFor(20);
    for (let pw = 122; pw >= 20; pw -= 2) {
      const cand = layoutFor(pw);
      if (cand.total <= usableH) {
        L = cand;
        break;
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: SURFACE,
            color: TEXT,
            fontFamily: "sans-serif",
            padding: BPAD,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", height: titleH }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{list.title}</div>
            {list.showAuthor && (
              <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 2 }}>A list by {list.author}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {groups.map((g, gi) => (
              <div key={gi} style={{ display: "flex", alignItems: "flex-start", marginBottom: gi < n - 1 ? RGAP : 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: labelW,
                    height: L.blocks[gi] - BGAP,
                    borderRadius: 12,
                    backgroundColor: g.tier ? TIER_COLOR[g.tier] : UNRANKED,
                    color: g.tier ? "#000" : TEXT,
                    fontSize: 34,
                    fontWeight: 800,
                    marginRight: 16,
                    flexShrink: 0,
                  }}
                >
                  {g.tier ?? "—"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", width: areaW, alignContent: "flex-start" }}>
                  {g.items.map((it, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        width: L.pw,
                        height: L.ph,
                        marginRight: BGAP,
                        marginBottom: BGAP,
                        borderRadius: 5,
                        overflow: "hidden",
                        backgroundColor: "#1d2130",
                        flexShrink: 0,
                      }}
                    >
                      {it.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.posterUrl} alt="" width={L.pw} height={L.ph} style={{ objectFit: "cover" }} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: "auto", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
              Haystackk<span style={{ display: "flex", color: "#e63946" }}>.</span>
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: MUTED }}>haystackk.com</div>
          </div>
        </div>
      ),
      { width: BW, height: BH },
    );
  }

  const headerH = list.showAuthor ? 112 : 76;
  const footerH = 56;
  const bodyH = groups.reduce((acc, g) => acc + g.slotH + 14, 0);
  const height = PAD * 2 + headerH + bodyH + footerH;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: SURFACE,
          color: TEXT,
          fontFamily: "sans-serif",
          padding: PAD,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 800, letterSpacing: -1 }}>{list.title}</div>
          {list.showAuthor && (
            <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 4 }}>A list by {list.author}</div>
          )}
        </div>

        {groups.map((g, gi) => (
          <div key={gi} style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: LABEL_W,
                height: g.visualH,
                borderRadius: 12,
                backgroundColor: g.tier ? TIER_COLOR[g.tier] : UNRANKED,
                color: g.tier ? "#000" : TEXT,
                fontSize: 42,
                fontWeight: 800,
                marginRight: LABEL_GAP,
                flexShrink: 0,
              }}
            >
              {g.tier ?? "—"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", width: POSTERS_W, alignContent: "flex-start" }}>
              {g.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: POSTER_W,
                    height: POSTER_H,
                    marginRight: GAP,
                    marginBottom: GAP,
                    borderRadius: 6,
                    overflow: "hidden",
                    backgroundColor: "#1d2130",
                    flexShrink: 0,
                  }}
                >
                  {it.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.posterUrl} alt="" width={POSTER_W} height={POSTER_H} style={{ objectFit: "cover" }} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", marginTop: "auto", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>
            Haystackk<span style={{ display: "flex", color: "#e63946" }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: MUTED }}>haystackk.com</div>
        </div>
      </div>
    ),
    { width: WIDTH, height },
  );
}
