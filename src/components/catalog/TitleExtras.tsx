import Link from "next/link";
import { titleExtras, type AwardSummary, type NamedRef } from "@/services/title-extras";

function awardLine(a: AwardSummary): string {
  const headline =
    a.oscars > 0
      ? `${a.oscars} Oscar${a.oscars > 1 ? "s" : ""}`
      : a.emmys > 0
        ? `${a.emmys} Emmy${a.emmys > 1 ? "s" : ""}`
        : null;
  const parts: string[] = [];
  if (a.wins > 0) parts.push(`Won ${a.wins}${headline ? ` (incl. ${headline})` : ""}`);
  if (a.nominations > 0) parts.push(`${a.nominations} nomination${a.nominations > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function PlaceLinks({ places }: { places: NamedRef[] }) {
  return (
    <span className="flex flex-wrap gap-x-1.5">
      {places.map((p, i) => (
        <span key={p.id}>
          <Link href={`/location/${p.id}`} className="text-accent-text hover:underline">
            {p.label}
          </Link>
          {i < places.length - 1 ? "," : ""}
        </span>
      ))}
    </span>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span aria-hidden className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="font-medium text-text">{label}: </span>
        <span className="text-text-muted">{children}</span>
      </div>
    </div>
  );
}

/** Async server island (Suspense-streamed): awards, source, and locations. */
export async function TitleExtras({ mediaType, tmdbId }: { mediaType: "movie" | "tv"; tmdbId: number }) {
  const x = await titleExtras(mediaType, tmdbId);
  const hasLocations = x.filmingLocations.length > 0 || x.narrativeLocations.length > 0;
  if (!x.awards && x.basedOn.length === 0 && !hasLocations) return null;

  return (
    <div className="mb-8 space-y-2 rounded-lg border border-border bg-surface-raised p-4 text-sm">
      {x.awards && (
        <Row icon="🏆" label="Awards">
          <span className="text-text">{awardLine(x.awards)}</span>
        </Row>
      )}
      {x.basedOn.length > 0 && (
        <Row icon="📖" label="Based on">
          {x.basedOn.map((s, i) => (
            <span key={s.id}>
              <Link href={`/source/${s.id}`} className="text-accent-text hover:underline">
                {s.label}
              </Link>
              {i < x.basedOn.length - 1 ? ", " : ""}
            </span>
          ))}
        </Row>
      )}
      {x.filmingLocations.length > 0 && (
        <Row icon="📍" label="Filmed in">
          <PlaceLinks places={x.filmingLocations} />
        </Row>
      )}
      {x.narrativeLocations.length > 0 && (
        <Row icon="🎬" label="Set in">
          <PlaceLinks places={x.narrativeLocations} />
        </Row>
      )}
    </div>
  );
}
