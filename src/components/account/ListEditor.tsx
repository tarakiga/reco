"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListEpisodePicker, type EpisodeResult } from "@/components/account/ListEpisodePicker";
import { DownloadTierImage } from "@/components/lists/DownloadTierImage";
import { TIERS, tierColor, TIER_NAME, type Tier } from "@/lib/lists/tiers";
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
  const [tiered, setTiered] = useState(initial.tiered);
  const [showAuthor, setShowAuthor] = useState(initial.showAuthor);
  const [items, setItems] = useState<OwnerListItem[]>(initial.items);
  const [savingMeta, setSavingMeta] = useState(false);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<TitleResult[]>([]);
  // The show whose episode picker is currently open (from a TV search result).
  const [episodeShow, setEpisodeShow] = useState<TitleResult | null>(null);

  const shareUrl = `${siteOrigin}/list/${initial.id}-${initial.slug}`;
  // Whole-title items already on the list (episode === null), for the "Add" state.
  const haveWhole = new Set(items.filter((i) => i.episode == null).map((i) => `${i.mediaType}:${i.tmdbId}`));

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
      toast({ title: next ? "Published, share link is live" : "Unpublished", variant: next ? "success" : "info" });
    } catch (err) {
      setPublished(!next);
      toast({ title: err instanceof Error ? err.message : "Couldn't update", variant: "danger" });
    }
  }

  async function toggleTiered(next: boolean) {
    setTiered(next);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}`, { method: "PATCH", body: { tiered: next } });
    } catch (err) {
      setTiered(!next);
      toast({ title: err instanceof Error ? err.message : "Couldn't update", variant: "danger" });
    }
  }

  async function toggleShowAuthor(next: boolean) {
    setShowAuthor(next);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}`, { method: "PATCH", body: { showAuthor: next } });
    } catch (err) {
      setShowAuthor(!next);
      toast({ title: err instanceof Error ? err.message : "Couldn't update", variant: "danger" });
    }
  }

  async function addItem(r: TitleResult) {
    try {
      const { itemId, titleId } = await meFetch<{ itemId: string; titleId: string }>(
        `/api/v1/me/lists/${initial.id}/items`,
        { method: "POST", body: { mediaType: r.mediaType, tmdbId: r.tmdbId } },
      );
      setItems((xs) => [
        ...xs,
        { id: itemId, titleId, tmdbId: r.tmdbId, mediaType: r.mediaType, title: r.title, year: r.year, posterUrl: r.posterUrl, href: r.href, season: null, episode: null, episodeName: null, tier: null, note: null },
      ]);
      setQ("");
      setResults([]);
      setEpisodeShow(null);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't add", variant: "danger" });
    }
  }

  async function addEpisode(show: TitleResult, ep: EpisodeResult) {
    try {
      const { itemId, titleId } = await meFetch<{ itemId: string; titleId: string }>(
        `/api/v1/me/lists/${initial.id}/items`,
        {
          method: "POST",
          body: { mediaType: "tv", tmdbId: show.tmdbId, season: ep.seasonNumber, episode: ep.episodeNumber, episodeName: ep.name },
        },
      );
      setItems((xs) => [
        ...xs,
        { id: itemId, titleId, tmdbId: show.tmdbId, mediaType: "tv", title: show.title, year: show.year, posterUrl: show.posterUrl, href: show.href, season: ep.seasonNumber, episode: ep.episodeNumber, episodeName: ep.name, tier: null, note: null },
      ]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't add episode", variant: "danger" });
    }
  }

  function onNoteChange(itemId: string, note: string) {
    setItems((xs) => xs.map((i) => (i.id === itemId ? { ...i, note } : i)));
  }

  async function saveNote(itemId: string, note: string) {
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, {
        method: "PATCH",
        body: { itemId, note: note.trim() || null },
      });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save note", variant: "danger" });
    }
  }

  async function setTier(item: OwnerListItem, tier: Tier | null) {
    const prev = items;
    setItems((xs) => xs.map((i) => (i.id === item.id ? { ...i, tier } : i)));
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, { method: "PATCH", body: { itemId: item.id, tier } });
    } catch (err) {
      setItems(prev);
      toast({ title: err instanceof Error ? err.message : "Couldn't set tier", variant: "danger" });
    }
  }

  async function removeItem(itemId: string) {
    const prev = items;
    setItems((xs) => xs.filter((i) => i.id !== itemId));
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, { method: "DELETE", body: { itemId } });
    } catch (err) {
      setItems(prev);
      toast({ title: err instanceof Error ? err.message : "Couldn't remove", variant: "danger" });
    }
  }

  // Swap an item with its neighbour. In tier mode the neighbour is the next item
  // in the SAME tier (so reordering stays within a band); otherwise it's adjacent.
  async function move(item: OwnerListItem, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    let j = idx + dir;
    if (tiered) {
      while (j >= 0 && j < items.length && (items[j].tier ?? null) !== (item.tier ?? null)) j += dir;
    }
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try {
      await meFetch(`/api/v1/me/lists/${initial.id}/items`, { method: "PUT", body: { orderedItemIds: next.map((i) => i.id) } });
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

  const episodeKeysForOpenShow = new Set(
    episodeShow
      ? items.filter((i) => i.tmdbId === episodeShow.tmdbId && i.episode != null).map((i) => `${i.season}:${i.episode}`)
      : [],
  );

  function rowInner(it: OwnerListItem, canUp: boolean, canDown: boolean) {
    return (
      <>
        <div className="flex items-center gap-3">
          <div className="aspect-2/3 w-9 shrink-0 overflow-hidden rounded border border-border bg-surface-overlay">
            {it.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.posterUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={it.href} className="truncate text-sm font-medium text-text hover:text-accent">{it.title}</Link>
            {it.episode != null ? (
              <p className="truncate text-xs text-accent">
                S{it.season} · E{it.episode}{it.episodeName ? ` · ${it.episodeName}` : ""}
              </p>
            ) : (
              it.year && <span className="ml-1 text-xs text-text-muted">{it.year}</span>
            )}
            {tiered && (
              <div className="mt-1.5 flex items-center gap-1">
                {TIERS.map((t) => {
                  const active = it.tier === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(it, active ? null : t)}
                      aria-label={`Tier ${t}`}
                      style={{ backgroundColor: active ? tierColor(t) : "transparent", borderColor: tierColor(t) }}
                      className={`h-5 w-6 rounded border text-[11px] font-bold ${active ? "text-black" : "text-text-muted"}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label="Move up" disabled={!canUp} onClick={() => move(it, -1)} className="rounded px-2 py-1 text-text-muted hover:text-text disabled:opacity-30">↑</button>
            <button type="button" aria-label="Move down" disabled={!canDown} onClick={() => move(it, 1)} className="rounded px-2 py-1 text-text-muted hover:text-text disabled:opacity-30">↓</button>
            <button type="button" aria-label="Remove" onClick={() => removeItem(it.id)} className="rounded px-2 py-1 text-danger hover:text-danger/80">✕</button>
          </div>
        </div>
        <textarea
          value={it.note ?? ""}
          onChange={(e) => onNoteChange(it.id, e.target.value)}
          onBlur={(e) => saveNote(it.id, e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Add a note for this pick (optional), why it's here, where it ranks…"
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
        />
      </>
    );
  }

  // Tier groups (S, A, B, C, then Unranked), preserving item order within each.
  const groups: { tier: Tier | null; items: OwnerListItem[] }[] = [
    ...TIERS.map((t) => ({ tier: t as Tier | null, items: items.filter((i) => i.tier === t) })),
    { tier: null, items: items.filter((i) => !i.tier) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Title + subtitle */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A list of movies I think you'll like" />
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={tiered} onChange={(e) => toggleTiered(e.target.checked)} className="size-4 accent-accent" />
          <span className="text-sm font-medium text-text">Tier list</span>
          <span className="text-xs text-text-muted">Group items into S / A / B / C tiers.</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={showAuthor} onChange={(e) => toggleShowAuthor(e.target.checked)} className="size-4 accent-accent" />
          <span className="text-sm font-medium text-text">Show byline</span>
          <span className="text-xs text-text-muted">Show the &ldquo;A list by you&rdquo; line at the top of the shared page.</span>
        </label>
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
          {tiered && (
            <>
              <DownloadTierImage idSlug={`${initial.id}-${initial.slug}`} slug={initial.slug} label="Download image" />
              <DownloadTierImage idSlug={`${initial.id}-${initial.slug}`} slug={initial.slug} format="banner" label="Banner (1920×384)" />
            </>
          )}
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

      {/* Add titles / episodes */}
      <div className="flex flex-col gap-2">
        <Input label="Add a movie, show, or episode" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a title…" />
        <p className="text-xs font-medium text-warning">
          For TV show episodes, first search for the show, then pick the episode.
        </p>
        {results.length > 0 && (
          <ul className="overflow-hidden rounded-md border border-border bg-surface-raised">
            {results.map((r) => {
              const added = haveWhole.has(`${r.mediaType}:${r.tmdbId}`);
              const pickerOpen = episodeShow?.tmdbId === r.tmdbId && episodeShow?.mediaType === r.mediaType;
              return (
                <li key={`${r.mediaType}-${r.tmdbId}`} className="border-b border-border last:border-b-0">
                  <div className="flex items-center gap-3 px-3 py-2">
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
                    {r.mediaType === "tv" && (
                      <button
                        type="button"
                        onClick={() => setEpisodeShow(pickerOpen ? null : r)}
                        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                      >
                        {pickerOpen ? "Close" : "Episodes"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => addItem(r)}
                      disabled={added}
                      className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      {added ? "Added" : r.mediaType === "tv" ? "Add show" : "Add"}
                    </button>
                  </div>
                  {pickerOpen && (
                    <div className="px-3 pb-3">
                      <ListEpisodePicker
                        tvId={r.tmdbId}
                        showTitle={r.title}
                        have={episodeKeysForOpenShow}
                        onAdd={(ep) => addEpisode(r, ep)}
                        onClose={() => setEpisodeShow(null)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-text">
          {items.length} {items.length === 1 ? "item" : "items"}
        </h3>
        {items.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
            Search above to add titles, or pick individual episodes from a show.
          </p>
        ) : tiered ? (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.tier ?? "unranked"} className="overflow-hidden rounded-lg border border-border" style={{ backgroundColor: tierColor(g.tier) }}>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className={`text-sm font-extrabold ${g.tier ? "text-black" : "text-text"}`}>{g.tier ?? "Unranked"}</span>
                  {g.tier && <span className="text-xs font-semibold text-black/80">· {TIER_NAME[g.tier]}</span>}
                  <span className={`ml-auto text-xs font-medium ${g.tier ? "text-black/70" : "text-text-muted"}`}>{g.items.length}</span>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  {g.items.length === 0 ? (
                    <p className={`px-1 py-1 text-xs ${g.tier ? "text-black/70" : "text-text-muted"}`}>
                      Tap the {g.tier ?? "S/A/B/C"} button on an item to place it here.
                    </p>
                  ) : (
                    g.items.map((it, idx) => (
                      <div key={it.id} className="rounded-md bg-surface-raised px-3 py-2.5">
                        {rowInner(it, idx > 0, idx < g.items.length - 1)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
            {items.map((it, i) => (
              <li key={it.id} className="px-3 py-2.5">{rowInner(it, i > 0, i < items.length - 1)}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom save, so you don't scroll up after editing a long list. */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={saveMeta} loading={savingMeta} disabled={!title.trim()}>
            Save list
          </Button>
        </div>
      )}
    </div>
  );
}
