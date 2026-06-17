import Link from "next/link";
import { MOODS } from "@/lib/moods";

export const metadata = {
  title: "Browse by mood",
  description: "Find something to watch by mood or occasion.",
};

function MoodTile({ slug, emoji, label, blurb }: { slug: string; emoji: string; label: string; blurb: string }) {
  return (
    <Link
      href={`/mood/${slug}`}
      className="group flex flex-col gap-1 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-accent/40 hover:bg-surface-overlay"
    >
      <span aria-hidden className="text-2xl">{emoji}</span>
      <span className="font-semibold text-text group-hover:text-accent">{label}</span>
      <span className="text-sm text-text-muted">{blurb}</span>
    </Link>
  );
}

export default function MoodsPage() {
  const moods = MOODS.filter((m) => m.kind === "mood");
  const occasions = MOODS.filter((m) => m.kind === "occasion");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-text">Browse by mood</h1>
        <p className="text-sm text-text-muted">Pick a vibe or an occasion and we&apos;ll line up the watches.</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Moods</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moods.map((m) => (
            <MoodTile key={m.slug} slug={m.slug} emoji={m.emoji} label={m.label} blurb={m.blurb} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Occasions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occasions.map((m) => (
            <MoodTile key={m.slug} slug={m.slug} emoji={m.emoji} label={m.label} blurb={m.blurb} />
          ))}
        </div>
      </section>
    </div>
  );
}
