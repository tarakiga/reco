import Link from "next/link";

// Vibe modifiers — each opens scene search for "<noun> like <title> but <mod>",
// which the query-expansion + embedding pipeline turns into real results.
const MODS = ["funnier", "scarier", "darker", "lighter", "shorter", "weirder"];

/** "Like this, but…" — quick vibe-shifted discovery from a title page. */
export function SimilarBut({ title, mediaType }: { title: string; mediaType: "movie" | "tv" }) {
  const noun = mediaType === "tv" ? "shows" : "movies";
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-text-muted">Like this, but&hellip;</span>
      {MODS.map((m) => (
        <Link
          key={m}
          href={`/find?q=${encodeURIComponent(`${noun} like ${title} but ${m}`)}`}
          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent-text"
        >
          {m}
        </Link>
      ))}
    </div>
  );
}
