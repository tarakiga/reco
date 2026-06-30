"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useToast } from "@/components/ui/Toast";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

/** Your personal tags for a title, clickable badges (→ /tags/<slug>) plus an
 *  add box that autocompletes your existing tags or creates a new one. Private. */
export function TitleTags({ mediaType, tmdbId }: { mediaType: "movie" | "tv"; tmdbId: number }) {
  const { isSignedIn } = useAuth();
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch(`/api/v1/me/title-tags?mediaType=${mediaType}&tmdbId=${tmdbId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTags(d.tags))
      .catch(() => {});
  }, [isSignedIn, mediaType, tmdbId]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAdding(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function openAdd() {
    setAdding(true);
    if (allTags.length === 0) {
      try {
        const d = await (await fetch("/api/v1/me/tags")).json();
        setAllTags(d.tags ?? []);
      } catch {
        /* ignore */
      }
    }
  }

  async function add(name: string) {
    const cleaned = name.trim();
    if (!cleaned) return;
    if (tags.some((t) => t.name.toLowerCase() === cleaned.toLowerCase())) {
      setQ("");
      setAdding(false);
      return;
    }
    try {
      const d = await (
        await fetch("/api/v1/me/title-tags", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaType, tmdbId, name: cleaned }),
        })
      ).json();
      if (d.tag) {
        setTags((ts) => [...ts, d.tag].sort((a, b) => a.name.localeCompare(b.name)));
        setAllTags((a) => (a.some((x) => x.id === d.tag.id) ? a : [...a, d.tag]));
      }
    } catch {
      toast({ title: "Couldn't add tag", variant: "danger" });
    } finally {
      setQ("");
      setAdding(false);
    }
  }

  async function remove(tag: Tag) {
    setTags((ts) => ts.filter((t) => t.id !== tag.id));
    try {
      await fetch("/api/v1/me/title-tags", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaType, tmdbId, tagId: tag.id }),
      });
    } catch {
      toast({ title: "Couldn't remove tag", variant: "danger" });
    }
  }

  if (!isSignedIn) return null;

  const have = new Set(tags.map((t) => t.slug));
  const ql = q.trim().toLowerCase();
  const suggestions = allTags
    .filter((t) => !have.has(t.slug) && t.name.toLowerCase().includes(ql))
    .slice(0, 6);
  const showCreate = ql.length > 0 && !allTags.some((t) => t.name.toLowerCase() === ql);

  return (
    <div ref={boxRef} className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden
          >
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
            <circle cx="7.5" cy="7.5" r="1.5" />
          </svg>
          Tags
        </span>

        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full bg-[#22e06b] px-2.5 py-1 text-xs"
          >
            <Link href={`/tags/${t.slug}`} className="font-semibold text-black transition-colors hover:text-black/70">
              #{t.name}
            </Link>
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove ${t.name}`}
              className="text-sm leading-none text-black/60 transition-colors hover:text-black"
            >
              ×
            </button>
          </span>
        ))}

        {adding ? (
          <div className="relative">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(q);
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Tag name…"
              className="h-7 w-40 rounded-full border border-border bg-surface px-3 text-xs text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
            />
            {(suggestions.length > 0 || showCreate) && (
              <div className="absolute left-0 top-8 z-20 w-52 overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-overlay">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => add(s.name)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-overlay"
                  >
                    #{s.name}
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    onClick={() => add(q)}
                    className="block w-full px-3 py-1.5 text-left text-xs font-medium text-accent-text hover:bg-surface-overlay"
                  >
                    Create “{q.trim()}”
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#22e06b] bg-[#22e06b]/10 px-2.5 py-1 text-xs font-semibold text-[#22e06b] transition-colors hover:bg-[#22e06b] hover:text-black"
          >
            + Add a tag
          </button>
        )}
      </div>

      {tags.length === 0 && !adding && (
        <p className="pl-0.5 text-xs text-text-muted">Organize titles your way. Only you can see these.</p>
      )}
    </div>
  );
}
