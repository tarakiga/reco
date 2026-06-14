"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const REGIONS: { value: string; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "NG", label: "Nigeria" },
  { value: "IN", label: "India" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "BR", label: "Brazil" },
];

interface Genre {
  id: number;
  name: string;
}

export function AccountSettings({
  initialRegion,
  initialGenres,
}: {
  initialRegion: string;
  initialGenres: number[];
}) {
  const toast = useToast();
  const { data: genresData } = useQuery({
    queryKey: ["genres-all"],
    queryFn: () => meFetch<{ genres: Genre[] }>("/api/v1/onboarding/genres"),
    staleTime: 60 * 60 * 1000,
  });

  const [region, setRegion] = useState(initialRegion);
  const [selected, setSelected] = useState<number[]>(initialGenres);
  const [saving, setSaving] = useState(false);

  function toggleGenre(id: number) {
    setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await meFetch("/api/v1/me/profile", {
        method: "PATCH",
        body: { region, preferredGenres: selected },
      });
      toast({ title: "Settings saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Couldn't save settings", variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  const genres = genresData?.genres ?? [];

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface-raised p-5 sm:p-6">
      <div className="max-w-xs">
        <Select label="Country / region" value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-text-muted">
          Sets the streaming services shown in Shuffle and Where to watch.
        </p>
      </div>

      <div>
        <span className="text-sm font-medium text-text">Preferred genres</span>
        <p className="mb-3 mt-0.5 text-xs text-text-muted">Used to tune Shuffle and your For-you feed.</p>
        {genres.length === 0 ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = selected.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  aria-pressed={on}
                  className={
                    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors " +
                    (on
                      ? "border-accent bg-accent text-text"
                      : "border-border bg-surface text-text hover:border-accent")
                  }
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-text transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
