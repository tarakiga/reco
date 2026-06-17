"use client";
import { useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PollSummary } from "@/services/polls";

const STATUS_LABEL: Record<PollSummary["status"], string> = {
  round1: "Round 1 — collecting picks",
  round2: "Round 2 — final vote",
  done: "Finished",
};

export function PollsManager({ initial, siteOrigin }: { initial: PollSummary[]; siteOrigin: string }) {
  const toast = useToast();
  const [polls, setPolls] = useState(initial);
  const [title, setTitle] = useState("");
  const [voters, setVoters] = useState(4);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const body: { title: string; expectedVoters: number; deadline?: string } = {
        title: title.trim(),
        expectedVoters: voters,
      };
      if (deadline) body.deadline = new Date(deadline).toISOString();
      const d = await meFetch<{ poll: { id: string; slug: string } }>("/api/v1/polls", { method: "POST", body });
      const summary: PollSummary = {
        id: d.poll.id,
        slug: d.poll.slug,
        title: title.trim(),
        status: "round1",
        expectedVoters: voters,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        createdAt: new Date().toISOString(),
        round1Votes: 0,
        winnerTitle: null,
      };
      setPolls((p) => [summary, ...p]);
      setTitle("");
      setDeadline("");
      toast({ title: "Vote created — share the link", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't create the vote", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setPolls((p) => p.filter((x) => x.id !== id));
    try {
      await meFetch(`/api/v1/polls`, { method: "DELETE", body: { id } }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  async function share(slug: string, pollTitle: string) {
    const url = `${siteOrigin}/vote/${slug}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Vote: ${pollTitle}`, text: `Help pick what we watch — ${pollTitle}`, url });
      } catch {
        // share sheet dismissed — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-text">Start a vote to watch</h3>
        <p className="text-xs text-text-muted">
          Friends each pick blind, then a genre-based runoff settles what you all watch.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's it for? e.g. Friday movie night"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Expected voters
            <input
              type="number"
              min={2}
              max={50}
              value={voters}
              onChange={(e) => setVoters(Math.max(2, Math.min(50, Number(e.target.value) || 2)))}
              className="h-9 w-24 rounded-md border border-border bg-surface px-3 text-sm text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Deadline (optional)
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={create}
            disabled={busy || !title.trim()}
            className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-text hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      {polls.length === 0 ? (
        <EmptyState
          title="No votes yet"
          description="Create a vote above, share the link, and let the group decide what to watch."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised">
          {polls.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/vote/${p.slug}`} className="truncate text-sm font-medium text-text hover:text-accent">
                  {p.title}
                </Link>
                <p className="truncate text-xs text-text-muted">
                  {STATUS_LABEL[p.status]}
                  {p.status === "done" && p.winnerTitle ? ` · 🏆 ${p.winnerTitle}` : ` · ${p.round1Votes}/${p.expectedVoters} in`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => share(p.slug, p.title)}
                aria-label="Share vote link"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-overlay"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                </svg>
                Share
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Delete vote"
                className="shrink-0 rounded px-2 py-1 text-danger hover:text-danger/80"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
