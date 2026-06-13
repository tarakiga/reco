import "server-only";
import { cacheTag } from "next/cache";
import { getPublishedOptions } from "./config";
import { getPublishedBlock as getPublishedBlockRaw } from "./content";
import type { PublishedBlock, PublishedOption } from "@/lib/contracts/config";

/**
 * Published options for a namespace, cached and tagged for revalidation on
 * publish. Returns [] when nothing is published — consumers MUST provide
 * their own safe defaults (build-guide rule).
 *
 * Cache tag: `config:options_namespace:<namespace>`
 * Invalidated by: revalidateTag(`config:options_namespace:<namespace>`) in
 * the publish route (src/app/api/v1/admin/config/publish/route.ts).
 */
export async function publishedOptions(namespace: string): Promise<PublishedOption[]> {
  "use cache";
  cacheTag(`config:options_namespace:${namespace}`);
  const result = await getPublishedOptions(namespace);
  const options: PublishedOption[] = result?.options ?? [];
  return options.filter((o) => o.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Published content block, cached + tagged. Null when never published.
 *
 * Cache tag: `config:content_block:<key>`
 * Invalidated by: revalidateTag(`config:content_block:<key>`) in the publish
 * route.
 */
export async function publishedBlock(key: string): Promise<PublishedBlock | null> {
  "use cache";
  cacheTag(`config:content_block:${key}`);
  return getPublishedBlockRaw(key);
}
