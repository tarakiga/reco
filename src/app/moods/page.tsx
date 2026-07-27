import Link from "next/link";
import { MOODS, type Mood } from "@/lib/moods";
import { backdropUrlCard } from "@/lib/tmdb/images";

export const metadata = {
  title: "Browse by mood",
  description: "Find something to watch by mood or occasion.",
};

/** Card colour laid over the art: solid across the left half, then fading to 50%
 *  by the right edge, so the film shows through on the right and the text half
 *  keeps its original contrast. */
const ART_SCRIM =
  "linear-gradient(to right, var(--color-surface-raised) 0%, var(--color-surface-raised) 50%, color-mix(in srgb, var(--color-surface-raised) 50%, transparent) 100%)";

function MoodTile({ mood }: { mood: Mood }) {
  const art = backdropUrlCard(mood.backdrop);
  return (
    <Link
      href={`/mood/${mood.slug}`}
      className="group relative isolate overflow-hidden rounded-xl border border-border bg-surface-raised transition-colors hover:border-accent/40"
    >
      {art && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-right bg-no-repeat"
            style={{ backgroundImage: `url(${art})` }}
          />
          <span aria-hidden className="absolute inset-0 -z-10" style={{ background: ART_SCRIM }} />
        </>
      )}
      <span className="flex flex-col gap-1 p-4">
        <span aria-hidden className="text-2xl">{mood.emoji}</span>
        <span className="font-semibold text-text group-hover:text-accent-text">{mood.label}</span>
        <span className="text-sm text-text-muted">{mood.blurb}</span>
      </span>
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
            <MoodTile key={m.slug} mood={m} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Occasions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occasions.map((m) => (
            <MoodTile key={m.slug} mood={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
