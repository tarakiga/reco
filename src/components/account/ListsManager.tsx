"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export interface ListSummaryVM {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  published: boolean;
  itemCount: number;
}

export function ListsManager({ initial, siteOrigin }: { initial: ListSummaryVM[]; siteOrigin: string }) {
  const router = useRouter();
  const toast = useToast();
  const [lists, setLists] = useState(initial);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const { list } = await meFetch<{ list: { id: string; slug: string } }>("/api/v1/me/lists", {
        method: "POST",
        body: { title: title.trim(), subtitle: subtitle.trim() || undefined },
      });
      router.push(`/account/lists/${list.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't create the list", variant: "danger" });
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await meFetch(`/api/v1/me/lists/${id}`, { method: "DELETE" });
      setLists((xs) => xs.filter((l) => l.id !== id));
      toast({ title: "List deleted", variant: "info" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't delete", variant: "danger" });
    } finally {
      setConfirmId(null);
    }
  }

  async function share(l: ListSummaryVM) {
    const url = `${siteOrigin}/list/${l.id}-${l.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Share link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">Create lists and share them as a page.</p>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "New list"}</Button>
      </div>

      {open && (
        <form onSubmit={create} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Top Ten Mind Movies" required />
          <Input label="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A list of movies I think you'll like" />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>Create list</Button>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <EmptyState title="No lists yet" description="Create your first shareable list — a themed set of movies or shows." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
          {lists.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/account/lists/${l.id}`} className="truncate font-medium text-text hover:text-accent">
                    {l.title}
                  </Link>
                  <Badge variant={l.published ? "success" : "neutral"}>{l.published ? "Published" : "Draft"}</Badge>
                </div>
                <p className="truncate text-xs text-text-muted">
                  {l.itemCount} {l.itemCount === 1 ? "title" : "titles"}
                  {l.subtitle ? ` · ${l.subtitle}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                <Link
                  href={`/account/lists/${l.id}`}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                >
                  Edit
                </Link>
                {l.published && (
                  <Link
                    href={`/list/${l.id}-${l.slug}`}
                    target="_blank"
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                  >
                    View
                  </Link>
                )}
                {l.published && (
                  <button
                    type="button"
                    onClick={() => share(l)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                  >
                    Share
                  </button>
                )}
                {confirmId === l.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      className="rounded-md bg-danger px-2.5 py-1.5 text-xs font-medium text-white"
                    >
                      Sure?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(l.id)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-surface-overlay"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
