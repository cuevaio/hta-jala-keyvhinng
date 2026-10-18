# CI/CD

One workflow, `.github/workflows/ci.yml`.

| Trigger        | Runs                                                |
| -------------- | --------------------------------------------------- |
| Pull request   | `verify`                                            |
| Push to `main` | `verify`, then `deploy` (production, one at a time) |

## verify

Against a throwaway Postgres 17: Prettier, ESLint, `tsc`, migration history check
(`db:check`), **schema/migration drift** (fails if the Drizzle schema changed without a
committed migration), migrations applied to an empty database, unit and integration
tests, production build, and the HTTP boundary tests against the built app.

## deploy

1. `vercel pull` fetches production settings (including the database URL).
2. **Migrate production** with `scripts/migrate.ts`, using `POSTGRES_URL_NON_POOLING`.
3. `vercel build --prod` and `vercel deploy --prebuilt --prod`.
4. **Smoke test** the production domain: `/api/health`, a real group search (exercises
   the new columns) and `/ride`. Failure marks the run red.

Migrations run before the new code, so every migration must work with the code that is
still serving traffic (expand, then contract): add columns as nullable or with a
backfill, and remove or rename in a later release. The database is forward-only; to
roll back code use `vercel rollback`.

Normal releases require committing the generated migration and pushing to `main`. GitHub Actions applies pending production migrations automatically after verification passes; do not run `bun run db:migrate` manually against production for a normal release. That command is for local or disposable test database setup.

## One-time setup

Vercel's Git integration is not connected for this project, so GitHub Actions deploys.
Do not connect both, or each push deploys twice.

```bash
gh secret set VERCEL_TOKEN                      # Vercel account token
gh variable set VERCEL_ORG_ID --body team_qFo3VtsGPLkfgjzJ2bIunLOj
gh variable set VERCEL_PROJECT_ID --body prj_o2JxzNFd9rnG1Mrp1AWOmIB609UV
gh variable set PRODUCTION_URL --body https://jala.oak4.xyz
```

Create a GitHub environment named `production` (optionally with required reviewers) and
protect `main` so `Verify` must pass before merge.

## Local equivalent

```bash
bun run format:check && bun run lint && bun run typecheck && bun run db:check
TEST_DATABASE_URL=postgres://... bun run test
```
