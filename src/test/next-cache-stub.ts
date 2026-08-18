// Vitest runs outside the React Server runtime, where `cacheLife` and `cacheTag`
// throw "only available in a Server Component". Tests alias "next/cache" to this
// module so a function carrying "use cache" can be called directly and asserted
// on its real behaviour. Next.js still applies the genuine caching in app builds.
//
// The stubs are deliberately inert: a unit test should see the uncached result,
// so the same input twice runs the body twice and assertions stay independent.
export function cacheLife(_profile?: unknown): void {}
export function cacheTag(..._tags: string[]): void {}
export function revalidateTag(..._args: unknown[]): void {}
