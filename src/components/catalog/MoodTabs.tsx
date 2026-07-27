import Link from "next/link";
import type { MoodMedia } from "@/lib/moods";

/** Movies / TV switcher. Rendered only for moods that have a curated TV list. */
export function MoodTabs({ slug, active }: { slug: string; active: MoodMedia }) {
  const tabs: { media: MoodMedia; label: string; href: string }[] = [
    { media: "movie", label: "Movies", href: `/mood/${slug}` },
    { media: "tv", label: "TV shows", href: `/mood/${slug}/tv` },
  ];
  return (
    <nav aria-label="Media type" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const on = t.media === active;
        return (
          <Link
            key={t.media}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={
              "px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (on
                ? "border-b-2 border-accent font-semibold text-text"
                : "border-b-2 border-transparent font-medium text-text-muted hover:text-text")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
