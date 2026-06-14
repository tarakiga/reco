"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { onboardingReducer, initialState, canProceed, MIN_GENRES, MIN_LIKES } from "./state";
import { OnboardingGenreStep } from "./OnboardingGenreStep";
import { OnboardingTitleStep } from "./OnboardingTitleStep";
import type { PickCard } from "@/lib/onboarding/picks";

export function TasteOnboarding({ onClose }: { onClose: () => void }) {
  const [state, dispatch] = useReducer(onboardingReducer, undefined, initialState);
  const [cardsByKey] = useState(() => new Map<string, PickCard>());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function toggleLike(key: string, card: PickCard) {
    cardsByKey.set(key, card);
    dispatch({ type: "toggleLike", key });
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    dispatch({ type: "setStep", step: "finishing" });
    const refs = (keys: Set<string>) =>
      [...keys]
        .map((k) => { const c = cardsByKey.get(k); return c ? { mediaType: c.mediaType, tmdbId: c.tmdbId } : null; })
        .filter((r): r is { mediaType: "movie" | "tv"; tmdbId: number } => r !== null);
    try {
      await meFetch("/api/v1/me/onboarding", {
        method: "POST",
        body: { genres: [...state.genres], likes: refs(state.likes), dislikes: refs(state.dislikes) },
      });
      await qc.invalidateQueries({ queryKey: ["for-you"] });
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      dispatch({ type: "setStep", step: "titles" });
      setSubmitting(false);
    }
  }

  const stepIndex = state.step === "genres" ? 1 : 2;
  const proceedLabel = state.step === "genres" ? "Continue" : "Finish";
  const counter =
    state.step === "genres"
      ? `${state.genres.size} selected${state.genres.size < MIN_GENRES ? ` — pick ${MIN_GENRES - state.genres.size} more` : ""}`
      : `${state.likes.size} selected${state.likes.size < MIN_LIKES ? ` — pick ${MIN_LIKES - state.likes.size} more` : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Build your taste profile" ref={dialogRef} tabIndex={-1}>
      <header className="flex items-center gap-4 border-b border-border px-5 py-4">
        <span className="text-lg font-bold text-text">Haystackk</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${stepIndex === 1 ? 30 : 65}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs text-text-muted">Step {stepIndex} of 2</span>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text">Skip for now</button>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-5 py-6">
        {state.step === "genres" && (
          <>
            <h1 className="text-2xl font-bold text-text">What do you love to watch?</h1>
            <p className="mb-5 mt-1 text-sm text-text-muted">Pick at least {MIN_GENRES} genres to get started.</p>
            <OnboardingGenreStep selected={state.genres} onToggle={(id) => dispatch({ type: "toggleGenre", id })} />
          </>
        )}
        {state.step === "titles" && (
          <>
            <h1 className="text-2xl font-bold text-text">Tap the ones you love</h1>
            <p className="mb-5 mt-1 text-sm text-text-muted">The more you tap, the sharper your matches.</p>
            <OnboardingTitleStep genres={[...state.genres]} likes={state.likes} onToggleLike={toggleLike} />
          </>
        )}
        {state.step === "finishing" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="size-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-lg font-medium text-text">Building your taste profile…</p>
          </div>
        )}
      </div>

      {state.step !== "finishing" && (
        <footer className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div aria-live="polite" className="text-sm">
            <span className="font-medium text-success">{counter}</span>
          </div>
          <div className="flex items-center gap-2">
            {state.step === "titles" && (
              <button type="button" onClick={() => dispatch({ type: "setStep", step: "genres" })} className="rounded-md border border-border bg-surface-raised px-4 py-2 text-sm text-text hover:bg-surface-overlay">Back</button>
            )}
            <button
              type="button"
              disabled={!canProceed(state) || submitting}
              onClick={() => (state.step === "genres" ? dispatch({ type: "setStep", step: "titles" }) : finish())}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-overlay disabled:text-text-muted"
            >
              {proceedLabel}
            </button>
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </footer>
      )}
    </div>
  );
}
