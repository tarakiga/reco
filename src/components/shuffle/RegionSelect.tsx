"use client";
import { useQuery } from "@tanstack/react-query";

interface Region {
  code: string;
  name: string;
}

export function RegionSelect({ region, onChange }: { region: string; onChange: (code: string) => void }) {
  const { data } = useQuery({
    queryKey: ["shuffle-regions"],
    queryFn: () => fetch("/api/v1/shuffle/regions").then((r) => r.json() as Promise<{ regions: Region[] }>),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const regions = data?.regions ?? [];

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-muted">Country</span>
      <select
        value={region}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Country"
        className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-text focus:outline-2 focus:outline-accent"
      >
        {regions.length === 0 && <option value={region}>{region}</option>}
        {regions.map((r) => (
          <option key={r.code} value={r.code}>{r.name}</option>
        ))}
      </select>
    </label>
  );
}
