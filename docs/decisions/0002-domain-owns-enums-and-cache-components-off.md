# 0002 – Domain owns lifecycle values; Cache Components disabled

**Status:** accepted

1. Lifecycle values live in `domain/` as `as const` arrays; Drizzle `pgEnum`s are built from them,
   so TypeScript unions and DB enums cannot drift. Tradeoff: `db/schema` imports domain files.
2. `create-next-app` enabled `cacheComponents`. It is turned off: event/session data is live, and
   every DB-backed page opts into per-request rendering with `await connection()`. Revisit with
   `"use cache"` when a caching strategy matters.
3. `shadcn init` generated imports from an unrelated npm package named `cn`; these were rewritten
   to the local `@/lib/utils` and the dependency removed.
