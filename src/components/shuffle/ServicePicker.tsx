"use client";
import { useEffect } from "react";
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

  function toggle(id: number) {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Streaming on</div>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                on ? "border-accent bg-accent text-white" : "border-border bg-surface-raised text-text hover:border-text-muted",
              )}
            >
              {p.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logoUrl} alt="" className="size-4 rounded" />
              )}
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
