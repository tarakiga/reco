import { logoUrl } from "./images";
import type { TmdbProvider, TmdbTitleDetail } from "./types";

export interface ProviderVM {
  id: number;
  name: string;
  logoUrl: string | null;
}
export interface RegionProviders {
  link: string | null;
  flatrate: ProviderVM[];
  free: ProviderVM[];
  ads: ProviderVM[];
  rent: ProviderVM[];
  buy: ProviderVM[];
}

function map(list: TmdbProvider[] | undefined): ProviderVM[] {
  return (list ?? []).map((p) => ({
    id: p.provider_id,
    name: p.provider_name,
    logoUrl: logoUrl(p.logo_path),
  }));
}

export function providersForRegion(
  watch: TmdbTitleDetail["watch/providers"] | undefined,
  region: string,
): RegionProviders | null {
  const r = watch?.results?.[region];
  if (!r) return null;
  return {
    link: r.link ?? null,
    flatrate: map(r.flatrate),
    free: map(r.free),
    ads: map(r.ads),
    rent: map(r.rent),
    buy: map(r.buy),
  };
}
