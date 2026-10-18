# Shared-session verification evidence

Scope: Stage 0–1; this is engineering verification with fictional participants, not user research.

- Production build served at localhost:3000.
- Browser A: Codex in-app browser, participant `Ana (prueba)`.
- Browser B: Chrome, participant `Luis (prueba)` volunteering to reserve.
- Both independently joined the same session; both displayed two participants with the correct own-member marker.
- Browser A picked up Browser B through polling, without a refresh.
- Refresh preserved the participant and own destination in each browser.
- Chrome checked at a 390 × 844 viewport; the room fit without horizontal clipping. Temporary viewport override was reset.
- Screenshots: `shared-session.png` and `shared-session-mobile.png`.
- Checks passed: ESLint, TypeScript, Prettier, production build, 16 unit tests, seven real PostgreSQL integration tests, and three HTTP integration tests against the production server.
- HTTP tests cover independent/reused opaque credentials, hashed token storage, member-only rosters, UUID cookie spoof rejection, JSON errors and cross-origin rejection. Fixtures are removed after each integration suite.

## Public verification

- Public production URL: https://jala-chi.vercel.app
- Vercel: `keyvhinngs-projects/jala`; deployment `dpl_HEeAQiyCtPZXmeaL4G5u3U6XqhjZ`, READY, Next.js 16.4.2, build 27 seconds, uploaded from the working tree.
- Neon: `jala-db`, explicitly selected `free_v3` plan, iad1. Migration and fictional seed succeeded. The environment file is ignored by Git and local Docker configuration remains separate.
- Unauthenticated HTTPS request to `/api/health` returned 200, `{ status: "ok", database: "up" }`.
- All three HTTP integration tests passed against the public URL and hosted database; they require no Vercel login or protection bypass.
- In-app browser joined as `Visitante A (prueba)`; independent Chrome joined as `Visitante B (prueba)` and volunteered to reserve.
- Both showed the same seven-person pool (five seed fixtures plus these two fictional test visitors), while showing only their own exact destination. These are waiting participants, not an assigned vehicle group.
- Browser A picked up Browser B via polling; refresh persistence was checked. Screenshot: `shared-session-public.png`.
- Production runtime log query `level:error` returned zero records in the verification window.
- No external log drain or continuous monitor is configured; only this bounded error scan was performed.
- GitHub repository auto-connection failed, so future pushes will not auto-deploy until the Vercel Git connection is configured.

No participant interviews, traction, ride savings, or actual completed rides are claimed.
