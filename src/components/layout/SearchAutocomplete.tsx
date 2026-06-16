"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CardFavouriteButton } from "@/components/catalog/CardFavouriteButton";
import { CardWatchlistButton } from "@/components/catalog/CardWatchlistButton";

interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}
interface PersonResult {
  kind: "person";
  tmdbId: number;
  name: string;
  profileUrl: string | null;
  href: string;
}
type Result = TitleResult | PersonResult;

/** Header search with async rich results — instant cards with quick add-to-
 *  watchlist + favourite, so users can act without opening a page. */
export function SearchAutocomplete() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const signedIn = isSignedIn ?? false;

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [corrected, setCorrected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch; abort the in-flight request when the query changes.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults((data.results ?? []).slice(0, 8));
        setCorrected(data.corrected ?? null);
      } catch {
        /* aborted or network error */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close on outside click / Escape.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  const titles = results.filter((r): r is TitleResult => r.kind === "title");
  const people = results.filter((r): r is PersonResult => r.kind === "person");
  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <form onSubmit={submit} className="flex w-full items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          type="search"
          aria-label="Search"
          placeholder="Search movies &amp; shows…"
          className="h-9 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90"
        >
          Search
        </button>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised shadow-overlay">
          {loading && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-muted">No matches</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto py-1">
              {corrected && (
                <p className="px-3 pb-1 pt-1.5 text-xs text-text-muted">
                  Showing results for <span className="font-medium text-text">{corrected}</span>
                </p>
              )}
              {titles.map((t) => (
                <div
                  key={`t-${t.tmdbId}`}
                  className="flex items-center gap-3 px-2 py-1.5 hover:bg-surface-overlay"
                >
                  <Link
                    href={t.href}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="aspect-2/3 w-9 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                      {t.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{t.title}</p>
                      <p className="text-xs text-text-muted">
                        {t.mediaType === "tv" ? "TV" : "Movie"}
                        {t.year ? ` · ${t.year}` : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <CardWatchlistButton mediaType={t.mediaType} tmdbId={t.tmdbId} initial={false} signedIn={signedIn} />
                    <CardFavouriteButton mediaType={t.mediaType} tmdbId={t.tmdbId} initial={false} signedIn={signedIn} />
                  </div>
                </div>
              ))}

              {people.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    People
                  </p>
                  {people.map((p) => (
                    <Link
                      key={`p-${p.tmdbId}`}
                      href={p.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-2 py-1.5 hover:bg-surface-overlay"
                    >
                      <div className="size-9 shrink-0 overflow-hidden rounded-full border border-border bg-surface-overlay">
                        {p.profileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profileUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </div>
                      <p className="truncate text-sm font-medium text-text">{p.name}</p>
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
