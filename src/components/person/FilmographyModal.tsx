"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import type { FilmographyCredit, PersonShowCredit, PersonEpisode } from "@/lib/tmdb/person";

export function FilmographyModal({
  personId,
  credit,
  onClose,
}: {
  personId: number;
  credit: FilmographyCredit | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<PersonShowCredit | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!credit || credit.mediaType !== "tv") return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/v1/person/${personId}/credit/${credit.tmdbId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PersonShowCredit | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [credit, personId]);

  if (!credit) return null;
  const isTv = credit.mediaType === "tv";

  // Group guest episodes by season.
  const bySeason = new Map<number, PersonEpisode[]>();
  for (const e of data?.episodes ?? []) {
    const arr = bySeason.get(e.seasonNumber) ?? [];
    arr.push(e);
    bySeason.set(e.seasonNumber, arr);
  }
  const seasons = [...bySeason.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <Modal open={!!credit} onClose={onClose} title={credit.title}>
      <div className="flex gap-4">
        {credit.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={credit.posterUrl} alt="" className="h-36 w-24 shrink-0 rounded-md border border-border object-cover" />
        )}
        <div className="min-w-0">
          {credit.character && (
            <p className="text-sm text-text-muted">
              as <span className="font-medium text-text">{credit.character}</span>
            </p>
          )}
          {credit.year != null && <p className="text-sm text-text-muted">{credit.year}</p>}
          {isTv && data?.mainCast && (
            <span className="mt-2 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              Main cast
            </span>
          )}
          <div className="mt-3">
            <Link href={credit.href} className="text-sm font-medium text-accent hover:underline">
              View {isTv ? "show" : "movie"} →
            </Link>
          </div>
        </div>
      </div>

      {isTv && (
        <div className="mt-4">
          {loading && <p className="text-sm text-text-muted">Loading episodes…</p>}
          {!loading && data && !data.mainCast && seasons.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {seasons.map(([season, eps]) => (
                <details key={season} open className="rounded-md border border-border bg-surface-raised">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">
                    Season {season} · {eps.length} episode{eps.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="space-y-1 px-3 pb-2">
                    {eps
                      .sort((a, b) => a.episodeNumber - b.episodeNumber)
                      .map((e) => (
                        <li key={e.episodeNumber} className="text-sm text-text-muted">
                          <span className="tabular-nums">E{e.episodeNumber}</span> — {e.name}
                          {e.year ? ` (${e.year})` : ""}
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
          {!loading && data && !data.mainCast && seasons.length === 0 && (
            <p className="text-sm text-text-muted">No specific episode credits listed.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
