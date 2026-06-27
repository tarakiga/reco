"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Cmd {
  label: string;
  sub?: string;
  href: string;
  /** undefined = a nav command (arrow icon); string|null = a title/person (poster). */
  posterUrl?: string | null;
}

const NAV: Cmd[] = [
  { label: "Find by scene", href: "/find", sub: "Describe a scene or the plot" },
  { label: "For you", href: "/for-you", sub: "Recommendations tuned to your taste" },
  { label: "TV Guide", href: "/guide", sub: "What's on, with reminders" },
  { label: "Moods", href: "/moods", sub: "Browse by mood" },
  { label: "Movies", href: "/movies" },
  { label: "Your account", href: "/account" },
];

/** Global ⌘K / Ctrl-K command palette: jump to a section or search titles + people. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Cmd[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

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
        const cmds: Cmd[] = (data.results ?? []).slice(0, 8).map((r: Record<string, unknown>) =>
          r.kind === "person"
            ? { label: r.name as string, sub: "Person", href: r.href as string, posterUrl: (r.profileUrl as string | null) ?? null }
            : {
                label: r.title as string,
                sub: `${r.mediaType === "tv" ? "TV" : "Movie"}${r.year ? ` · ${r.year}` : ""}`,
                href: r.href as string,
                posterUrl: (r.posterUrl as string | null) ?? null,
              },
        );
        setResults(cmds);
        setSel(0);
      } catch {
        /* aborted */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const items = useMemo<Cmd[]>(() => (q.trim().length >= 2 ? results : NAV), [q, results]);

  function go(c: Cmd) {
    setOpen(false);
    router.push(c.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = items[sel];
      if (c) go(c);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-raised shadow-overlay">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search titles, people, or jump to…"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-muted">{q.trim().length >= 2 ? "No matches" : "Type to search"}</li>
          ) : (
            items.map((c, i) => (
              <li key={`${c.href}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(c)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === sel ? "bg-surface-overlay" : ""}`}
                >
                  {c.posterUrl !== undefined ? (
                    <div className="aspect-2/3 w-7 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                      {c.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                  ) : (
                    <span className="w-7 text-center text-text-muted" aria-hidden>
                      →
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{c.label}</span>
                    {c.sub && <span className="block truncate text-xs text-text-muted">{c.sub}</span>}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-3 border-t border-border px-4 py-1.5 text-[11px] text-text-muted">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
