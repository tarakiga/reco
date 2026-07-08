"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { ProviderVM } from "@/lib/tmdb/providers";

export function ServicePicker({
  region, selected, onChange,
}: {
  region: string; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const { data } = useQuery({
    queryKey: ["shuffle-providers", region],
    queryFn: () =>
      fetch(`/api/v1/shuffle/providers?region=${region}`).then((r) => r.json() as Promise<{ providers: ProviderVM[] }>),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const providers = data?.providers ?? [];
  const key = `reco:shuffle:services:${region}`;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate selection from localStorage once per region.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(saved) && saved.length && selected.length === 0) onChange(saved.map(Number));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function persist(next: number[]) {
    onChange(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function toggle(id: number) {
    persist(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  const chosen = providers.filter((p) => selected.includes(p.id));
  const summary =
    selected.length === 0
      ? "Any service"
      : chosen.length === 0
        ? `${selected.length} selected`
        : chosen.length <= 2
          ? chosen.map((p) => p.name).join(", ")
          : `${chosen.length} services`;

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Streaming on</div>
      <div ref={ref} className="relative w-full sm:w-72">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm transition-colors hover:bg-surface-overlay focus:outline-2 focus:outline-accent"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate", selected.length ? "text-text" : "text-text-muted")}>{summary}</span>
            {selected.length > 0 && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{selected.length}</span>
            )}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label="Streaming services"
            className="absolute left-0 z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-raised p-1 shadow-overlay"
          >
            {providers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">No services for this region.</p>
            ) : (
              <>
                {selected.length > 0 && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-text-muted">
                    <span>{selected.length} selected</span>
                    <button type="button" onClick={() => persist([])} className="font-medium text-accent-text hover:underline">
                      Clear
                    </button>
                  </div>
                )}
                {providers.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        on ? "bg-surface-overlay text-text" : "text-text hover:bg-surface-overlay",
                      )}
                    >
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-white" : "border-border")}>
                        {on && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      {p.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoUrl} alt="" className="size-4 shrink-0 rounded" />
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
