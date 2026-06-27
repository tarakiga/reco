import { ImageResponse } from "next/og";
import { parseListId, getListForView, getListForOwner } from "@/services/lists";
import { getCurrentProfile } from "@/services/profile";
import { TIERS, TIER_COLOR, type Tier } from "@/lib/lists/tiers";

// Downloadable PNG of a tier list — coloured S/A/B/C bands with poster strips.
const SURFACE = "#0b0d12";
const TEXT = "#f2f4f8";
const MUTED = "#9aa3b2";
const UNRANKED = "#39414f";
const MAX_PER_TIER = 11;

export async function GET(_req: Request, { params }: { params: Promise<{ idSlug: string }> }) {
  const { idSlug } = await params;
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
  ].filter((g) => g.items.length > 0);

  const width = 1200;
  const rowH = 150;
  const headerH = 130;
  const height = headerH + groups.length * (rowH + 12) + 60;

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
          padding: 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 800, letterSpacing: -1 }}>{list.title}</div>
          {list.showAuthor && (
            <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 4 }}>A list by {list.author}</div>
          )}
        </div>

        {groups.map((g, gi) => (
          <div key={gi} style={{ display: "flex", alignItems: "center", marginBottom: 12, height: rowH }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 110,
                height: rowH,
                borderRadius: 12,
                backgroundColor: g.tier ? TIER_COLOR[g.tier] : UNRANKED,
                color: g.tier ? "#000" : TEXT,
                fontSize: 46,
                fontWeight: 800,
                marginRight: 16,
                flexShrink: 0,
              }}
            >
              {g.tier ?? "—"}
            </div>
            <div style={{ display: "flex", flex: 1, alignItems: "center", overflow: "hidden" }}>
              {g.items.slice(0, MAX_PER_TIER).map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 90,
                    height: rowH - 10,
                    marginRight: 8,
                    borderRadius: 6,
                    overflow: "hidden",
                    backgroundColor: "#1d2130",
                    flexShrink: 0,
                  }}
                >
                  {it.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.posterUrl} alt="" width={90} height={rowH - 10} style={{ objectFit: "cover" }} />
                  ) : null}
                </div>
              ))}
              {g.items.length > MAX_PER_TIER && (
                <div style={{ display: "flex", alignItems: "center", color: MUTED, fontSize: 28, marginLeft: 6 }}>
                  +{g.items.length - MAX_PER_TIER}
                </div>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 26, fontWeight: 700 }}>
          Haystackk<span style={{ display: "flex", color: "#e63946" }}>.</span>
        </div>
      </div>
    ),
    { width, height },
  );
}
