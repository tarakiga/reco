"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { meFetch } from "@/lib/me-client";
import { CompletionBar } from "@/components/completion/CompletionBar";
import type { SeasonSummary, EpisodeVM, EpisodeCastMember } from "@/lib/tmdb/episodes";

function CheckButton({ watched, onClick }: { watched: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={watched}
      aria-label={watched ? "Mark unwatched" : "Mark watched"}
      title={watched ? "Watched" : "Mark watched"}
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
        watched ? "border-success bg-success text-black" : "border-border text-text-muted hover:border-accent hover:text-accent-text"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </button>
  );
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function fmtRuntime(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

/** Deep-link target parsed from the URL hash: `#s3` (season) or `#s3e5` (episode). */
interface HashTarget {
  season: number;
  episode: number | null;
}
function parseHashTarget(): HashTarget | null {
  if (typeof window === "undefined") return null;
  const m = /^#s(\d+)(?:e(\d+))?$/i.exec(window.location.hash);
  if (!m) return null;
  return { season: Number(m[1]), episode: m[2] ? Number(m[2]) : null };
}

/** Copy a shareable deep link (and reflect it in the address bar) for a season
 *  or episode anchor. Sibling of the accordion toggle, never nested in it. */
function CopyLinkButton({ hash, label }: { hash: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}#${hash}`;
        history.replaceState(null, "", `#${hash}`);
        navigator.clipboard
          ?.writeText(url)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-overlay hover:text-accent-text"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
        </svg>
      )}
    </button>
  );
}

function CastAvatar({ member }: { member: EpisodeCastMember }) {
  return (
    <Link href={member.href} className="group w-full text-center">
      <div className="mx-auto flex size-14 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-overlay text-sm text-text-muted transition-colors group-hover:border-accent">
        {member.profileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profileUrl} alt={member.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          member.name.charAt(0)
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium leading-tight text-text group-hover:text-accent-text">
        {member.name}
      </p>
      {member.character && (
        <p className="text-[10px] text-text-muted">{member.character}</p>
      )}
    </Link>
  );
}

function EpisodeRow({
  ep,
  seasonNumber,
  highlight,
  watched,
  onToggle,
  signedIn,
}: {
  ep: EpisodeVM;
  seasonNumber: number;
  /** Deep-link target: scroll into view on mount and flash a ring briefly. */
  highlight: boolean;
  watched: boolean;
  onToggle: () => void;
  signedIn: boolean;
}) {
  const [showCast, setShowCast] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const meta = [fmtDate(ep.airDate), fmtRuntime(ep.runtime)].filter(Boolean).join(" · ");

  // Only offer "View more" when the 2-line clamp actually hides text.
  useEffect(() => {
    const el = overviewRef.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, []);

  // When this row is the deep-link target, scroll it into view once it renders.
  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  return (
    <li
      ref={rowRef}
      id={`s${seasonNumber}e${ep.episodeNumber}`}
      className={`group scroll-mt-24 rounded-md transition-shadow ${highlight ? "ring-2 ring-accent" : ""}`}
    >
      <div className="flex gap-3">
        <div className="aspect-video w-28 shrink-0 self-start overflow-hidden rounded-md border border-border bg-surface-overlay">
          {ep.stillUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ep.stillUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate text-sm font-medium text-text">
              {ep.episodeNumber}. {ep.name}
            </h4>
            <div className="flex shrink-0 items-center gap-1.5">
              {signedIn && <CheckButton watched={watched} onClick={onToggle} />}
              <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <CopyLinkButton hash={`s${seasonNumber}e${ep.episodeNumber}`} label="Copy link to this episode" />
              </span>
              {ep.voteAverage ? (
                <span className="text-xs font-medium text-warning">★ {ep.voteAverage.toFixed(1)}</span>
              ) : null}
            </div>
          </div>
          {meta && <p className="mt-0.5 text-xs text-text-muted">{meta}</p>}
          {ep.overview && (
            <div className="mt-1">
              <p
                ref={overviewRef}
                className={`text-sm text-text-muted ${expanded ? "" : "line-clamp-2"}`}
              >
                {ep.overview}
              </p>
              {(clamped || expanded) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="mt-0.5 text-xs font-medium text-text-muted underline underline-offset-2 transition-colors hover:text-text"
                >
                  {expanded ? "View less" : "View more"}
                </button>
              )}
            </div>
          )}
          {ep.cast.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCast((s) => !s)}
              aria-expanded={showCast}
              className="mt-2 text-xs font-medium text-accent-text transition-colors hover:text-accent-text"
            >
              {showCast ? "Hide episode cast" : `Show episode cast (${ep.cast.length})`}
            </button>
          )}
        </div>
      </div>
      {/* Expanded cast spans the full row so it isn't cramped into the text column. */}
      {ep.cast.length > 0 && showCast && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {ep.cast.map((m) => (
            <CastAvatar key={m.id} member={m} />
          ))}
        </div>
      )}
    </li>
  );
}

function SeasonItem({
  tvId,
  season,
  defaultOpen,
  isTarget,
  targetEpisode,
  watched,
  onToggle,
  onMarkSeason,
  signedIn,
}: {
  tvId: number;
  season: SeasonSummary;
  defaultOpen: boolean;
  /** This season is the current deep-link target. */
  isTarget: boolean;
  /** Episode number to scroll to within this season, or null for season-only. */
  targetEpisode: number | null;
  watched: Set<string>;
  onToggle: (season: number, episode: number) => void;
  onMarkSeason: (season: number, episodes: number[], watched: boolean) => void;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flashEp, setFlashEp] = useState<number | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tv-season", tvId, season.seasonNumber],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tv/${tvId}/season/${season.seasonNumber}`);
      if (!res.ok) throw new Error("Failed to load season");
      return res.json() as Promise<{ episodes: EpisodeVM[] }>;
    },
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });
  const episodes = data?.episodes ?? [];
  const seasonWatchedCount = signedIn
    ? [...watched].filter((k) => k.startsWith(`${season.seasonNumber}:`)).length
    : 0;
  // "Mark season watched" only makes sense once the season has fully aired — every
  // loaded episode has an air date in the past. An ongoing/upcoming season hides
  // the bulk action; individual episode checks still work.
  const seasonComplete =
    episodes.length > 0 &&
    episodes.every((e) => e.airDate != null && new Date(e.airDate).getTime() <= Date.now());

  // Becoming the deep-link target: open this season. Runs after mount (not during
  // render) so the server/client first paint match — no hydration mismatch.
  useEffect(() => {
    if (!isTarget) return;
    setOpen(true);
    // Season-only target: scroll to the header now. Episode targets scroll
    // themselves once their row loads (handled in EpisodeRow).
    if (!targetEpisode) wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isTarget, targetEpisode]);

  // Flash the targeted episode once its data has loaded, then fade the ring.
  useEffect(() => {
    if (!isTarget || !targetEpisode || episodes.length === 0) return;
    setFlashEp(targetEpisode);
    const t = setTimeout(() => setFlashEp(null), 2000);
    return () => clearTimeout(t);
  }, [isTarget, targetEpisode, episodes.length]);

  return (
    <div ref={wrapRef} id={`s${season.seasonNumber}`} className="scroll-mt-24">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 py-3 text-left transition-colors hover:text-accent-text"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`size-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="font-semibold text-text">{season.name}</span>
          <span className="text-sm text-text-muted">
            {season.episodeCount} {season.episodeCount === 1 ? "episode" : "episodes"}
            {season.year ? ` · ${season.year}` : ""}
          </span>
          {signedIn && seasonWatchedCount > 0 && (
            <span className="text-xs font-medium text-success">{seasonWatchedCount}/{season.episodeCount} seen</span>
          )}
        </button>
        <CopyLinkButton hash={`s${season.seasonNumber}`} label="Copy link to this season" />
      </div>
      {open && (
        <div className="pb-4">
          {isLoading ? (
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex gap-3">
                  <div className="aspect-video w-28 shrink-0 animate-pulse rounded-md bg-surface-overlay" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-surface-overlay" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-surface-overlay" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <p className="text-sm text-text-muted">Couldn&apos;t load this season. Try again later.</p>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-text-muted">No episode details available.</p>
          ) : (
            <>
              {signedIn && seasonComplete && (
                <button
                  type="button"
                  onClick={() => {
                    const allWatched = episodes.every((e) => watched.has(`${season.seasonNumber}:${e.episodeNumber}`));
                    onMarkSeason(season.seasonNumber, episodes.map((e) => e.episodeNumber), !allWatched);
                  }}
                  className="mb-3 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent-text"
                >
                  {episodes.every((e) => watched.has(`${season.seasonNumber}:${e.episodeNumber}`)) ? "Unmark all" : "Mark season watched"}
                </button>
              )}
              {signedIn && !seasonComplete && episodes.length > 0 && (
                <p className="mb-3 text-xs text-text-muted">Mark season unlocks once the finale has aired.</p>
              )}
              <ul className="space-y-3">
                {episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.episodeNumber}
                    ep={ep}
                    seasonNumber={season.seasonNumber}
                    highlight={ep.episodeNumber === flashEp}
                    watched={watched.has(`${season.seasonNumber}:${ep.episodeNumber}`)}
                    onToggle={() => onToggle(season.seasonNumber, ep.episodeNumber)}
                    signedIn={signedIn}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SeasonsAccordion({ tvId, seasons }: { tvId: number; seasons: SeasonSummary[] }) {
  const [target, setTarget] = useState<HashTarget | null>(null);
  const { isSignedIn } = useAuth();
  const signedIn = isSignedIn ?? false;
  const [watched, setWatched] = useState<Set<string>>(new Set());

  const { data: watchedData } = useQuery({
    queryKey: ["episode-watches", tvId],
    queryFn: () => meFetch<{ episodes: { season: number; episode: number }[] }>(`/api/v1/me/episodes?tmdbId=${tvId}`),
    enabled: signedIn,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (watchedData) setWatched(new Set(watchedData.episodes.map((e) => `${e.season}:${e.episode}`)));
  }, [watchedData]);

  // Optimistic local toggles; the API call is fire-and-forget.
  function toggle(seasonNumber: number, episode: number) {
    const key = `${seasonNumber}:${episode}`;
    const isWatched = watched.has(key);
    const next = new Set(watched);
    if (isWatched) next.delete(key);
    else next.add(key);
    setWatched(next);
    meFetch("/api/v1/me/episodes", { method: "POST", body: { tmdbId: tvId, season: seasonNumber, episode, watched: !isWatched } }).catch(() => {});
  }
  function markSeason(seasonNumber: number, eps: number[], watchedFlag: boolean) {
    const next = new Set(watched);
    for (const e of eps) {
      const k = `${seasonNumber}:${e}`;
      if (watchedFlag) next.add(k);
      else next.delete(k);
    }
    setWatched(next);
    meFetch("/api/v1/me/episodes", { method: "POST", body: { tmdbId: tvId, season: seasonNumber, episodes: eps, watched: watchedFlag } }).catch(() => {});
  }

  // Resolve the deep-link target from the URL hash, and keep it in sync if the
  // hash changes (in-page link click, pasted URL). Effect-only → no SSR hash read.
  useEffect(() => {
    const sync = () => {
      const t = parseHashTarget();
      setTarget(t && seasons.some((s) => s.seasonNumber === t.season) ? t : null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [seasons]);

  if (seasons.length === 0) return null;
  const totalEpisodes = seasons.reduce((sum, s) => sum + (s.episodeCount || 0), 0);

  return (
    <div>
      {signedIn && totalEpisodes > 0 && (
        <div className="mb-3">
          <CompletionBar label="Episodes watched" watched={Math.min(watched.size, totalEpisodes)} total={totalEpisodes} />
        </div>
      )}
      <div className="divide-y divide-border rounded-lg border border-border bg-surface-raised px-4">
        {seasons.map((s, i) => {
          const isTarget = target?.season === s.seasonNumber;
          return (
            <SeasonItem
              key={s.seasonNumber}
              tvId={tvId}
              season={s}
              defaultOpen={target ? isTarget : i === 0}
              isTarget={!!isTarget}
              targetEpisode={isTarget ? target!.episode : null}
              watched={watched}
              onToggle={toggle}
              onMarkSeason={markSeason}
              signedIn={signedIn}
            />
          );
        })}
      </div>
    </div>
  );
}
