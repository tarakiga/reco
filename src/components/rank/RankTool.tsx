"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";

interface Pick {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
}
interface SearchResult {
  kind: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
}

type Phase = "build" | "rank" | "done";

function Poster({ p, big }: { p: Pick; big?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-surface-overlay ${big ? "w-40 sm:w-52" : "w-full"}`}>
      <div className="aspect-2/3">
        {p.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
    </div>
  );
}

/** "Rank these": add titles, then a series of this-or-that picks (binary-insertion
 *  sort, so it asks the minimum comparisons) produce a ranking you can save. */
export function RankTool() {
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("build");
  const [pool, setPool] = useState<Pick[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  // Ranking state (binary insertion).
  const [sorted, setSorted] = useState<Pick[]>([]);
  const [remaining, setRemaining] = useState<Pick[]>([]);
  const [inserting, setInserting] = useState<{ item: Pick; lo: number; hi: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults((data.results ?? []).filter((r: SearchResult) => r.kind === "title").slice(0, 6));
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const have = new Set(pool.map((p) => `${p.mediaType}:${p.tmdbId}`));

  function add(r: SearchResult) {
    if (have.has(`${r.mediaType}:${r.tmdbId}`)) return;
    setPool((xs) => [...xs, { mediaType: r.mediaType, tmdbId: r.tmdbId, title: r.title, year: r.year, posterUrl: r.posterUrl }]);
    setQ("");
    setResults([]);
  }
  function removeFromPool(key: string) {
    setPool((xs) => xs.filter((p) => `${p.mediaType}:${p.tmdbId}` !== key));
  }

  function start() {
    if (pool.length < 2) return;
    const [first, second, ...rest] = pool;
    setSorted([first]);
    setRemaining(rest);
    setInserting({ item: second, lo: 0, hi: 1 });
    setPhase("rank");
  }

  function choose(itemWins: boolean) {
    if (!inserting) return;
    let { lo, hi } = inserting;
    const item = inserting.item;
    const mid = Math.floor((lo + hi) / 2);
    if (itemWins) hi = mid;
    else lo = mid + 1;
    if (lo >= hi) {
      const next = [...sorted];
      next.splice(lo, 0, item);
      setSorted(next);
      if (remaining.length === 0) {
        setInserting(null);
        setPhase("done");
      } else {
        const [head, ...rest] = remaining;
        setRemaining(rest);
        setInserting({ item: head, lo: 0, hi: next.length });
      }
    } else {
      setInserting({ item, lo, hi });
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { list } = await meFetch<{ list: { id: string } }>("/api/v1/me/lists", {
        method: "POST",
        body: { title: "My ranking", subtitle: "Ranked with Haystackk" },
      });
      for (const p of sorted) {
        await meFetch(`/api/v1/me/lists/${list.id}/items`, { method: "POST", body: { mediaType: p.mediaType, tmdbId: p.tmdbId } });
      }
      router.push(`/account/lists/${list.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save. Are you signed in?", variant: "danger" });
      setSaving(false);
    }
  }

  function reset() {
    setPhase("build");
    setSorted([]);
    setRemaining([]);
    setInserting(null);
  }

  // ---- Build phase ----
  if (phase === "build") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-text-muted">Add the movies or shows you want to rank, then answer a few quick this-or-that picks.</p>
        <div className="relative max-w-md">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search to add a title…"
            className="h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
          />
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised shadow-overlay">
              {results.map((r) => (
                <li key={`${r.mediaType}-${r.tmdbId}`}>
                  <button type="button" onClick={() => add(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-overlay">
                    <span className="text-sm text-text">{r.title}</span>
                    <span className="text-xs text-text-muted">{r.year ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pool.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
            {pool.map((p) => (
              <div key={`${p.mediaType}:${p.tmdbId}`} className="relative">
                <button
                  type="button"
                  onClick={() => removeFromPool(`${p.mediaType}:${p.tmdbId}`)}
                  aria-label="Remove"
                  className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-danger"
                >
                  ×
                </button>
                <Poster p={p} />
                <p className="mt-1 truncate text-xs text-text-muted">{p.title}</p>
              </div>
            ))}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={start}
            disabled={pool.length < 2}
            className="inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            Start ranking ({pool.length})
          </button>
        </div>
      </div>
    );
  }

  // ---- Rank phase ----
  if (phase === "rank" && inserting) {
    const mid = Math.floor((inserting.lo + inserting.hi) / 2);
    const opponent = sorted[mid];
    const placed = sorted.length;
    const totalKnown = pool.length;
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-sm text-text-muted">Which do you prefer? ({placed}/{totalKnown} placed)</p>
        <div className="flex items-center gap-4 sm:gap-8">
          <button type="button" onClick={() => choose(true)} className="flex flex-col items-center gap-2 rounded-lg p-2 transition-transform hover:scale-105">
            <Poster p={inserting.item} big />
            <span className="max-w-40 truncate text-sm font-medium text-text sm:max-w-52">{inserting.item.title}</span>
          </button>
          <span className="text-lg font-bold text-text-muted">vs</span>
          <button type="button" onClick={() => choose(false)} className="flex flex-col items-center gap-2 rounded-lg p-2 transition-transform hover:scale-105">
            <Poster p={opponent} big />
            <span className="max-w-40 truncate text-sm font-medium text-text sm:max-w-52">{opponent.title}</span>
          </button>
        </div>
        <button type="button" onClick={reset} className="text-xs text-text-muted hover:text-text">
          Start over
        </button>
      </div>
    );
  }

  // ---- Done phase ----
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Your ranking</h2>
      <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
        {sorted.map((p, i) => (
          <li key={`${p.mediaType}:${p.tmdbId}`} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 shrink-0 text-center text-sm font-bold text-text-muted">{i + 1}</span>
            <div className="aspect-2/3 w-8 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
              {p.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <span className="truncate text-sm text-text">{p.title}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as a list"}
        </button>
        <button type="button" onClick={reset} className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-text hover:bg-surface-overlay">
          Start over
        </button>
        <Link href="/account?tab=lists" className="text-sm text-text-muted hover:text-text">
          Your lists
        </Link>
      </div>
    </div>
  );
}
