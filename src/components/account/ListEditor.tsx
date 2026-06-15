"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OwnerList, OwnerListItem } from "@/services/lists";

interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}

export function ListEditor({ initial, siteOrigin }: { initial: OwnerList; siteOrigin: string }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [published, setPublished] = useState(initial.published);
  const [items, setItems] = useState<OwnerListItem[]>(initial.items);
  const [savingMeta, setSavingMeta] = useState(false);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<TitleResult[]>([]);

  const shareUrl = `${siteOrigin}/list/${initial.id}-${initial.slug}`;
  const have = new Set(items.map((i) => `${i.mediaType}:${i.tmdbId}`));

  // Debounced search for adding titles.
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
        setResults((data.results ?? []).filter((r: { kind: string }) => r.kind === "title").slice(0, 6));
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}`, {
        method: "PATCH",
        body: { title: title.trim(), subtitle: subtitle.trim() || null },
      });
      toast({ title: "Saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save", variant: "danger" });
    } finally {
      setSavingMeta(false);
    }
  }

  async function togglePublish() {
    const next = !published;
    setPublished(next);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}`, { method: "PATCH", body: { published: next } });
      toast({ title: next ? "Published — share link is live" : "Unpublished", variant: next ? "success" : "info" });
    } catch (err) {
      setPublished(!next);
      toast({ title: err instanceof Error ? err.message : "Couldn't update", variant: "danger" });
    }
  }

  async function addItem(r: TitleResult) {
    try {
      const { titleId } = await meFetch<{ titleId: string }>(`/api/v1/me/lists/${initial.id}/items`, {
        method: "POST",
        body: { mediaType: r.mediaType, tmdbId: r.tmdbId },
      });
      setItems((xs) => [
        ...xs,
        { titleId, tmdbId: r.tmdbId, mediaType: r.mediaType, title: r.title, year: r.year, posterUrl: r.posterUrl, href: r.href },
      ]);
      setQ("");
      setResults([]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't add", variant: "danger" });
    }
  }

  async function removeItem(titleId: string) {
    const prev = items;
    setItems((xs) => xs.filter((i) => i.titleId !== titleId));
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, { method: "DELETE", body: { titleId } });
    } catch (err) {
      setItems(prev);
      toast({ title: err instanceof Error ? err.message : "Couldn't remove", variant: "danger" });
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, {
        method: "PUT",
        body: { orderedTitleIds: next.map((i) => i.titleId) },
      });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't reorder", variant: "danger" });
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Share link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title + subtitle */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A list of movies I think you'll like" />
        <div className="flex justify-end">
          <Button onClick={saveMeta} loading={savingMeta} disabled={!title.trim()}>
            Save details
          </Button>
        </div>
      </div>

      {/* Publish + share */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <div>
          <p className="text-sm font-medium text-text">{published ? "Published" : "Draft"}</p>
          <p className="text-xs text-text-muted">
            {published ? "Anyone with the link can view this list." : "Only you can see this until you publish."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {published && (
            <>
              <Link href={shareUrl} target="_blank" className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-overlay">
                View
              </Link>
              <button type="button" onClick={copyShare} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-overlay">
                Copy link
              </button>
            </>
          )}
          <Button variant={published ? "secondary" : "primary"} onClick={togglePublish}>
            {published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Add titles */}
      <div className="flex flex-col gap-2">
        <Input label="Add a movie or show" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search to add…" />
        {results.length > 0 && (
          <ul className="overflow-hidden rounded-md border border-border bg-surface-raised">
            {results.map((r) => {
              const added = have.has(`${r.mediaType}:${r.tmdbId}`);
              return (
                <li key={`${r.mediaType}-${r.tmdbId}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="aspect-2/3 w-8 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                    {r.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{r.title}</p>
                    <p className="text-xs text-text-muted">{r.mediaType === "tv" ? "TV" : "Movie"}{r.year ? ` · ${r.year}` : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(r)}
                    disabled={added}
                    className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {added ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-text">
          {items.length} {items.length === 1 ? "title" : "titles"}
        </h3>
        {items.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
            Search above to add titles to your list.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
            {items.map((it, i) => (
              <li key={it.titleId} className="flex items-center gap-3 px-3 py-2">
                <div className="aspect-2/3 w-9 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
                  {it.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={it.href} className="truncate text-sm font-medium text-text hover:text-accent">{it.title}</Link>
                  {it.year && <span className="ml-1 text-xs text-text-muted">{it.year}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-2 py-1 text-text-muted hover:text-text disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded px-2 py-1 text-text-muted hover:text-text disabled:opacity-30">↓</button>
                  <button type="button" aria-label="Remove" onClick={() => removeItem(it.titleId)} className="rounded px-2 py-1 text-danger hover:text-danger/80">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
