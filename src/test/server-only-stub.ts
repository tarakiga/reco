// Vitest runs outside the React Server runtime; "server-only" throws there.
// Tests alias the package to this empty module. Next.js still enforces the
// real guard in app builds.
export {};
