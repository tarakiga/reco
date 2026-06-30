"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { meFetch } from "@/lib/me-client";
import { useToast } from "@/components/ui/Toast";
import { MoviePicker } from "./MoviePicker";
import type { PollViewState, PollOption } from "@/services/polls";

const fmtDeadline = (iso: string) =>
  new Date(iso).toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Poster({ url, className = "" }: { url: string | null; className?: string }) {
  return (
    <div className={`aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
    </div>
  );
}

function ProgressBar({ now, total }: { now: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((now / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-text-muted">
        {now} of {total} voted
      </p>
    </div>
  );
}

export function PollRoom({ initial, shareUrl }: { initial: PollViewState; shareUrl: string }) {
  const toast = useToast();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;

  const refresh = useCallback(async () => {
    try {
      const d = await meFetch<{ state: PollViewState }>(`/api/v1/polls/${initial.slug}`);
      setState(d.state);
    } catch {
      /* transient */
    }
  }, [initial.slug]);

  // Poll for others' votes / round transitions while the vote is live.
  useEffect(() => {
    if (state.status === "done") return;
    const id = setInterval(() => {
      if (!busyRef.current) refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [state.status, refresh]);

  async function vote(r: { mediaType: "movie" | "tv"; tmdbId: number; title?: string }) {
    setBusy(true);
    try {
      const d = await meFetch<{ state: PollViewState }>(`/api/v1/polls/${initial.slug}/vote`, {
        method: "POST",
        body: { mediaType: r.mediaType, tmdbId: r.tmdbId },
      });
      setState(d.state);
      toast({ title: r.title ? `Voted: ${r.title}` : "Vote recorded", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't record your vote", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function closeRound() {
    setBusy(true);
    try {
      const d = await meFetch<{ state: PollViewState }>(`/api/v1/polls/${initial.slug}/close`, { method: "POST" });
      setState(d.state);
      toast({ title: "Round closed", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't close", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function copyShare() {
    navigator.clipboard?.writeText(shareUrl).then(
      () => toast({ title: "Link copied", variant: "success" }),
      () => toast({ title: "Couldn't copy", variant: "danger" }),
    );
  }

  const roundLabel = state.status === "round1" ? "Round 1" : state.status === "round2" ? "Round 2" : "Result";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-accent-text">Vote to watch · {roundLabel}</p>
        <h1 className="text-2xl font-semibold text-text">{state.title}</h1>
        {state.deadline && state.status !== "done" && (
          <p className="text-sm text-text-muted">
            {state.deadlinePassed ? "Deadline passed" : `Closes ${fmtDeadline(state.deadline)}`}
          </p>
        )}
      </header>

      {/* Creator: share link + close control */}
      {state.isCreator && state.status !== "done" && (
        <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-xs text-text-muted"
            />
            <button
              type="button"
              onClick={copyShare}
              className="h-9 shrink-0 rounded-md bg-accent px-3 text-sm font-medium text-text hover:bg-accent-hover"
            >
              Copy
            </button>
          </div>
          {state.canClose ? (
            <button
              type="button"
              onClick={closeRound}
              disabled={busy}
              className="h-9 w-full rounded-md border border-border bg-surface text-sm font-medium text-text hover:bg-surface-overlay disabled:opacity-50"
            >
              {state.status === "round1" ? "Close round 1 & reveal" : "Close & crown the winner"}
            </button>
          ) : (
            <p className="text-xs text-text-muted">
              {state.deadline && !state.deadlinePassed
                ? `You can close early once the deadline passes (${fmtDeadline(state.deadline)}).`
                : "Waiting for the first vote before you can close."}
            </p>
          )}
        </div>
      )}

      {/* ---------------- Round 1 (blind pick) ---------------- */}
      {state.status === "round1" && (
        <section className="space-y-4 rounded-lg border border-border bg-surface-raised p-4">
          <ProgressBar now={state.votesIn} total={state.votesNeeded} />
          {!state.signedIn && (
            <p className="text-xs text-text-muted">No account needed — you&apos;re voting as a guest.</p>
          )}
          {state.myPick ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Poster url={state.myPick.posterUrl} className="w-12 shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Your pick</p>
                  <p className="text-sm font-medium text-text">{state.myPick.title}</p>
                </div>
              </div>
              {state.canVote && (
                <div>
                  <p className="mb-1 text-xs text-text-muted">Change your pick</p>
                  <MoviePicker placeholder="Search for a different title…" disabled={busy} onPick={vote} />
                </div>
              )}
              <p className="text-xs text-text-muted">Picks stay hidden until all {state.votesNeeded} votes are in.</p>
            </div>
          ) : state.canVote ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Pick one movie or show — it&apos;s a blind vote.</p>
              <MoviePicker placeholder="Search and pick your title…" disabled={busy} onPick={vote} />
              <p className="text-xs text-text-muted">No one can see picks until everyone has voted.</p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">This vote is full ({state.expectedVoters} voters).</p>
          )}
        </section>
      )}

      {/* ---------------- Round 1 reveal ---------------- */}
      {state.reveal && (
        <section className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
          <div>
            <h2 className="text-sm font-semibold text-text">Round 1 results</h2>
            {state.reveal.topGenres.length > 0 && (
              <p className="text-xs text-text-muted">
                The group leaned <span className="text-text">{state.reveal.topGenres.join(", ")}</span> — those advance.
              </p>
            )}
          </div>
          <ul className="space-y-2">
            {state.reveal.picks.map((p) => (
              <RevealRow key={p.titleId} p={p} />
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Round 2 ballot ---------------- */}
      {state.status === "round2" && state.round2 && (
        <section className="space-y-4 rounded-lg border border-border bg-surface-raised p-4">
          <div>
            <h2 className="text-sm font-semibold text-text">Round 2 — pick the winner</h2>
            <p className="text-xs text-text-muted">From the genres the group leaned toward. Blind until the round closes.</p>
          </div>
          <ProgressBar now={state.votesIn} total={state.votesNeeded} />
          {!state.canVote ? (
            <p className="text-sm text-text-muted">Only round-1 voters take part in round 2.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {state.round2.map((o) => (
                <BallotCard
                  key={o.titleId}
                  o={o}
                  selected={state.myPick?.titleId === o.titleId}
                  disabled={busy}
                  onPick={() => {
                    const m = /\/title\/(movie|tv)\/(\d+)-/.exec(o.href);
                    if (m) vote({ mediaType: m[1] as "movie" | "tv", tmdbId: Number(m[2]), title: o.title });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------- Winner ---------------- */}
      {state.status === "done" && (
        <section className="space-y-4">
          {state.winner ? (
            <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">🏆 The group is watching</p>
              <Link href={state.winner.href} className="mx-auto block w-32">
                <Poster url={state.winner.posterUrl} />
              </Link>
              <Link href={state.winner.href} className="block text-lg font-semibold text-text hover:text-accent-text">
                {state.winner.title}
                {state.winner.year ? <span className="text-text-muted"> ({state.winner.year})</span> : null}
              </Link>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
              No clear winner — not enough votes were cast.
            </p>
          )}
          {state.round2 && (
            <div className="rounded-lg border border-border bg-surface-raised p-4">
              <h2 className="mb-2 text-sm font-semibold text-text">Final tally</h2>
              <ul className="space-y-1">
                {[...state.round2]
                  .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
                  .map((o) => (
                    <li key={o.titleId} className="flex items-center justify-between text-sm">
                      <span className="text-text">{o.title}</span>
                      <span className="text-text-muted">
                        {o.votes ?? 0} {o.votes === 1 ? "vote" : "votes"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RevealRow({ p }: { p: PollOption }) {
  return (
    <li className={`flex items-center gap-3 rounded-md p-2 ${p.survived ? "bg-surface-overlay" : "opacity-45"}`}>
      <Poster url={p.posterUrl} className="w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {p.title}
          {p.year ? <span className="text-text-muted"> ({p.year})</span> : null}
        </p>
        <p className="truncate text-xs text-text-muted">{p.genres.join(" · ") || "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm text-text">
          {p.votes} {p.votes === 1 ? "vote" : "votes"}
        </p>
        {!p.survived && <p className="text-[10px] uppercase tracking-wide text-text-muted">Eliminated</p>}
      </div>
    </li>
  );
}

function BallotCard({
  o,
  selected,
  disabled,
  onPick,
}: {
  o: PollOption;
  selected: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={`group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors disabled:opacity-50 ${
        selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface-overlay"
      }`}
    >
      <Poster url={o.posterUrl} />
      <span className="truncate px-0.5 text-xs font-medium text-text">{o.title}</span>
      {selected && <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text">Your pick</span>}
    </button>
  );
}
