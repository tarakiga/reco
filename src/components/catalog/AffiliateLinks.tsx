import { getAffiliates } from "@/services/affiliates";
import {
  amazonSearchUrl,
  appleTvSearchUrl,
  fandangoTicketsUrl,
  DEFAULT_DISCLOSURE,
} from "@/lib/affiliates";

interface Props {
  title: string;
  year: number | null;
  mediaType: "movie" | "tv";
  /** Movie is currently in cinemas — gates the Fandango tickets link. */
  inTheaters?: boolean;
}

/**
 * Affiliate "Ways to watch" block. Renders nothing unless at least one matching
 * affiliate id is configured (and live) in /admin/affiliates — so the site
 * stays clean until monetization is switched on. Links carry rel="sponsored".
 */
export async function AffiliateLinks({ title, year, mediaType, inTheaters = false }: Props) {
  const cfg = await getAffiliates();

  const links: { href: string; label: string }[] = [];
  const amazon = amazonSearchUrl(title, year, cfg.amazonTag);
  if (amazon) links.push({ href: amazon, label: "Rent or buy on Amazon" });
  const apple = appleTvSearchUrl(title, cfg.appleToken);
  if (apple) links.push({ href: apple, label: "Watch on Apple TV" });
  if (mediaType === "movie" && inTheaters) {
    const tickets = fandangoTicketsUrl(title, cfg.fandangoCode);
    if (tickets) links.push({ href: tickets, label: "Get tickets" });
  }

  if (links.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text">Ways to watch</h2>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-overlay px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-accent"
            >
              {l.label}
              <span aria-hidden>↗</span>
            </a>
          ))}
        </div>
        <p className="text-xs text-text-muted">{cfg.disclosure ?? DEFAULT_DISCLOSURE}</p>
      </div>
    </section>
  );
}
