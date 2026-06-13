import "server-only";
import { publishedOptions, publishedBlock } from "./public-config";
import { BRAND_NAME as FALLBACK_BRAND } from "@/lib/brand";
import { NAV_LINKS as FALLBACK_NAV } from "@/lib/nav";

export interface SiteNavLink { href: string; label: string; }

/** Brand name from the "brand" content block (HTML stripped), else interim fallback. */
export async function getBrandName(): Promise<string> {
  const block = await publishedBlock("brand");
  const text = block?.body?.replace(/<[^>]+>/g, "").trim();
  return text && text.length > 0 ? text : FALLBACK_BRAND;
}

/** Nav links from the "nav" options namespace, else interim fallback.
 *  Each option's value is { href, label }. */
export async function getNavLinks(): Promise<SiteNavLink[]> {
  const opts = await publishedOptions("nav");
  const links = opts
    .map((o) => o.value as Partial<SiteNavLink> | null)
    .filter((v): v is SiteNavLink => !!v && typeof v.href === "string" && typeof v.label === "string");
  return links.length > 0 ? links : FALLBACK_NAV;
}
