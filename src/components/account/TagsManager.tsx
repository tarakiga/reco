"use client";
import { useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export interface TagVM {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function TagsManager({ initial }: { initial: TagVM[] }) {
  const toast = useToast();
  const [tags, setTags] = useState(initial);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function rename(id: string) {
    const name = editName.trim();
    if (!name) return;
    try {
      const { slug } = await meFetch<{ slug: string }>(`/api/v1/me/tags/${id}`, {
        method: "PATCH",
        body: { name },
      });
      setTags((ts) =>
        ts.map((t) => (t.id === id ? { ...t, name, slug } : t)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditId(null);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't rename", variant: "danger" });
    }
  }

  async function remove(id: string) {
    try {
      await meFetch(`/api/v1/me/tags/${id}`, { method: "DELETE" });
      setTags((ts) => ts.filter((t) => t.id !== id));
      toast({ title: "Tag deleted", variant: "info" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't delete", variant: "danger" });
    } finally {
      setConfirmId(null);
    }
  }

  if (tags.length === 0) {
    return (
      <EmptyState
        title="No tags yet"
        description="Tag movies and shows from their detail page (next to Favourite) — e.g. “Shark shows” — and they'll collect here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
      {tags.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
          {editId === t.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                rename(t.id);
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                aria-label="Tag name"
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text focus:outline-2 focus:outline-accent"
              />
              <Button type="submit" size="sm">Save</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
            </form>
          ) : (
            <>
              <Link href={`/tags/${t.slug}`} className="min-w-0 flex-1 truncate font-medium text-text hover:text-accent">
                #{t.name}
              </Link>
              <span className="text-xs text-text-muted">
                {t.count} {t.count === 1 ? "title" : "titles"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditId(t.id);
                    setEditName(t.name);
                  }}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
                >
                  Rename
                </button>
                {confirmId === t.id ? (
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="rounded-md bg-danger px-2.5 py-1.5 text-xs font-medium text-white"
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(t.id)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-surface-overlay"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
