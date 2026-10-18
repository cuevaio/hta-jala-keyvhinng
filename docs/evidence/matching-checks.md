# Local matching verification — 2026-10-18

Verified from `.worktrees/matching-engine`, using local PostgreSQL and the public OSRM
road-routing service. This is local engineering evidence, not public deployment or user research.

- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun run test`: 67 unit tests passed; environment-gated integration suites skipped in this run.
- Explicit local PostgreSQL run of `matching.test.ts` and `participation.test.ts`: 16 tests passed.
- Final combined run with `TEST_APP_URL` and `TEST_DATABASE_URL`: all 86 tests passed across 11 files, including HTTP account/participation tests; none skipped.
- `bun run build`: default Turbopack production build passed. The first restricted run failed
  downloading existing Google Fonts; after network access and clearing that run's generated
  cache, the unchanged build configuration passed.
- Browser button called the real matching HTTP handler, which obtained live OSRM estimates
  and created one group of three. Saved route duration was 268.9 seconds; recommended shares
  were 3334, 3333, 3333 basis points. No participant exceeded the 300-second detour limit.
- All three independent account requests returned byte-equivalent saved party projections.
- A second independent browser loaded the same saved group; desktop and 390px mobile
  screenshots were inspected: `matching-group.png`, `matching-group-mobile.png`.
- HTTP checks: unsigned request 401, signed-in nonmember 403, cross-origin mutation 403,
  nonmember waiting-room read 403. Assigned member retry 200 with no new group.
- Database tests cover concurrent rounds, no routing under assignment locks, edits during
  routing, late-arrival/volunteer inclusion, outages, session expiry, no-delegate waiting,
  privacy and complete rollback after a real second-party insertion constraint failure.

Review verdict: **Approve** for the documented matching slice. Group acceptance,
cancellation/rematching, verification, external booking and completion are deferred.
The user authorized committing the account/UI work together with matching and merging
the combined result directly into `main`.
