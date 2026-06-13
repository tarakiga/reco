import type { ProviderVM } from "@/lib/tmdb/providers";

export function ProviderLogoRow({ label, providers }: { label: string; providers: ProviderVM[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-16 text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) =>
          p.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.logoUrl}
              alt={p.name}
              title={p.name}
              className="h-8 w-8 rounded-md border border-border"
              loading="lazy"
            />
          ) : (
            <span key={p.id} className="rounded-md border border-border px-2 py-1 text-xs text-text">
              {p.name}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
