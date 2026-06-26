import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseListId, getListForView, type ViewListItem } from "@/services/lists";
import { ListCard } from "@/components/lists/ListCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TIERS, tierColor, TIER_NAME, type Tier } from "@/lib/lists/tiers";

export async function generateMetadata({ params }: { params: Promise<{ idSlug: string }> }) {
  const { idSlug } = await params;
  const id = parseListId(idSlug);
  if (!id) return {};
  const list = await getListForView(id);
  if (!list) return {};
  const description = list.subtitle ?? `A list by ${list.author} on Haystackk.`;
  return {
    title: list.title,
    description,
    openGraph: { title: list.title, description, type: "website" },
  };
}

export default async function ListPage({ params }: { params: Promise<{ idSlug: string }> }) {
  // Force dynamic so an unpublished list reliably 404s (no prerendered 200 shell).
  await connection();
  const { idSlug } = await params;
  const id = parseListId(idSlug);
  if (!id) notFound();

  const list = await getListForView(id);
  if (!list) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-text-muted">A list by {list.author}</p>
        <h1 className="mt-1 text-3xl font-bold text-text sm:text-4xl">{list.title}</h1>
        {list.subtitle && <p className="mt-2 text-lg text-text-muted">{list.subtitle}</p>}
        <p className="mt-3 text-sm text-text-muted">
          {list.items.length} {list.items.length === 1 ? "title" : "titles"}
        </p>
      </header>

      {list.items.length === 0 ? (
        <EmptyState title="This list is empty" description="The author hasn't added any titles yet." />
      ) : list.tiered ? (
        <TierGroups items={list.items} />
      ) : (
        <div className="space-y-3">
          {list.items.map((item, i) => (
            <ListCard key={`${item.mediaType}-${item.tmdbId}-${i}`} item={item} index={i} />
          ))}
        </div>
      )}

      <footer className="mt-10 border-t border-border pt-6 text-sm text-text-muted">
        Made with{" "}
        <Link href="/" className="font-medium text-accent hover:underline">
          Haystackk
        </Link>
        , find what to watch.
      </footer>
    </div>
  );
}

/** Tier-list rendering: items grouped into coloured S/A/B/C bands (empty tiers
 *  hidden), with an Unranked bucket last when present. */
function TierGroups({ items }: { items: ViewListItem[] }) {
  const groups: { tier: Tier | null; items: ViewListItem[] }[] = [
    ...TIERS.map((t) => ({ tier: t as Tier | null, items: items.filter((i) => i.tier === t) })),
    { tier: null, items: items.filter((i) => !i.tier) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.tier ?? "unranked"}>
          {/* Sticky band: stays pinned (below the nav) while you scroll its tier,
              then the next tier's band takes over. No overflow-hidden ancestor,
              or sticky breaks. */}
          <div
            className="sticky top-16 z-20 flex items-baseline gap-2 rounded-t-xl px-4 py-2.5"
            style={{ backgroundColor: tierColor(g.tier) }}
          >
            <span className={`text-lg font-extrabold ${g.tier ? "text-black" : "text-text"}`}>{g.tier ?? "Unranked"}</span>
            {g.tier && <span className="text-sm font-semibold text-black/80">· {TIER_NAME[g.tier]}</span>}
            <span className={`ml-auto text-sm font-medium ${g.tier ? "text-black/70" : "text-text-muted"}`}>
              {g.items.length} {g.items.length === 1 ? "pick" : "picks"}
            </span>
          </div>
          <div className="space-y-3 rounded-b-xl p-3" style={{ backgroundColor: tierColor(g.tier) }}>
            {g.items.map((item, i) => (
              <ListCard key={`${item.mediaType}-${item.tmdbId}-${i}`} item={item} index={i} showRank={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
