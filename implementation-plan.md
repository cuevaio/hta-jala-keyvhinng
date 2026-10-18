# Reference flow implementation

1. Change summary: align the entry experience with the supplied mobile passenger journey and add the desktop admin simulation. Preserve live email authentication and ride APIs. SMS delivery, production QR identity verification, and production history/ratings require backend follow-up; the reference journey is explicitly a demo.
2. Existing system: `/ride` searches and creates real groups; `/sessions/[id]` handles live matching and chat; `/sign-in` uses email/password. Existing fare allocation guarantees 10,000 basis points and exact cent totals. Reuse it for simulation and fare previews.
3. Approach: add a scoped passenger UI on `/`, with explicit transitions and browser-local sample history/ratings, keeping photos/messages in memory only. Add `/admin` with reproducible generated destinations, grouping, route plotting, and calculated metrics. Preserve all existing service contracts.
4. Contract: passenger inputs are name, origin, district/address, departure, delegate choice, messages, ratings, and a positive fare. Outputs are navigable reference screens and local demo records. Errors are inline; no simulated action is represented as a real SMS, verification, booking, or server write. Only demo trip summaries and ratings persist; selfies/chat never persist.
5. Risks: refresh resets an active demo; private photos must be revoked/cleared; local storage can fail; double submission cannot duplicate history; mobile controls must remain reachable; admin synthetic data is public and clearly labeled rather than exposing production users.
6. Tests: unit tests for simulation conservation, capacity, detour and fare-share invariants, deterministic regeneration, exact fare totals; run lint/typecheck/full existing tests. Browser-check the full passenger journey, narrow viewport, admin controls, and console errors.
7. Reviewability: new flow, scoped CSS, simulator domain and tests, root page/header/footer integration. No schema migration, auth changes, or new production API contract.

Implementation notes:

- `/` is the interactive reference journey, explicitly labeled as a sample. `/ride`, `/sessions/[id]`, `/sign-in`, and all existing APIs retain their live behavior. Email entry from the sample forwards to `/ride` after login.
- `/admin` is a public synthetic validation simulator; it is not a privileged production admin surface.
- The QR encodes a namespaced demonstration token; verification is explicit code entry and never claims production identity verification.
- Only fare summaries and private sample ratings enter versioned localStorage. Chat and user-selected photos stay in memory and clear on trip start or explicit exit.
- Fare values use the existing segment-distance allocation and exact cent apportionment. Sample amounts may differ by a cent from the rounded visual reference.
- Existing project logo and a licensed sample portrait are retained in place of the reference's alternative logo and illustrated avatars.
