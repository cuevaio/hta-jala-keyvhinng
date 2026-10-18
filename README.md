# Jala

Real-time taxi-sharing coordination for people leaving the same place (venues, universities, malls, stations) for **Hack The Andes 2026** (Lima, Perú).
People are grouped by where they are, where they are going and when, a volunteer
delegate books a taxi through an existing service (e.g. Uber), and costs are split by recommended
percentages. Jala operates no vehicles and processes no payments in the MVP.

Status: **the core journey works end to end** (sign up, pick a place, join with a destination,
road-based matching, confirm the split, start and finish the trip). Contact between members,
notifications, departure times, safety features and place administration are not built yet.
All seeded data is fictional. See [docs/status.md](docs/status.md) for what is done, what is
missing and what comes next.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Bun · PostgreSQL 17 · Drizzle ORM · Tailwind CSS 4 ·
shadcn/ui · Zod · Vitest · ESLint · Prettier · Docker Compose.

## Requirements

- [Bun](https://bun.sh) ≥ 1.3
- Docker (for local PostgreSQL)

## Setup

```bash
bun install
cp .env.example .env.local     # dev-only credentials, matches docker-compose.yml
bun run db:up                  # start PostgreSQL
bun run db:migrate             # apply migrations
bun run db:seed                # fictional Lima demo data
bun dev                        # http://localhost:3000
```

### Environment variables

| Variable              | Required | Default                     | Description                            |
| --------------------- | -------- | --------------------------- | -------------------------------------- |
| `DATABASE_URL`        | yes      | –                           | PostgreSQL connection string           |
| `NEXT_PUBLIC_APP_URL` | no       | `http://localhost:3000`     | Public base URL                        |
| `LOG_LEVEL`           | no       | `info`                      | `debug` \| `info` \| `warn` \| `error` |
| `ROUTING_BASE_URL`    | no       | public OSRM demo            | OSRM-compatible routing server         |
| `RESEND_API_KEY`      | no       | – (log-only mailer)         | Enables password reset emails          |
| `MAIL_FROM`           | no       | `Jala <jala@jala.oak4.xyz>` | Sender for emails                      |

`.env.local` is git-ignored; never commit real credentials.

## Commands

| Command                           | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `bun dev`                         | Dev server                                                 |
| `bun run build` / `bun run start` | Production build / serve                                   |
| `bun run lint`                    | ESLint                                                     |
| `bun run typecheck`               | `tsc --noEmit`                                             |
| `bun run test`                    | Vitest unit tests                                          |
| `bun run format`                  | Prettier                                                   |
| `bun run db:up`                   | Start PostgreSQL via Docker Compose                        |
| `bun run db:generate`             | Generate SQL migration from schema changes                 |
| `bun run db:migrate`              | Apply migrations                                           |
| `bun run db:reset`                | Drop and recreate the local database                       |
| `bun run db:seed`                 | Reseed fictional data (re-runnable)                        |
| `bun run demo`                    | Reset, migrate and seed; prints demo URLs                  |
| `bun run demo:crew <id> <step>`   | Act as the fictional passengers (confirm, start, complete) |

## API

All responses are `{ "data": ... }` or `{ "error": { "code", "message", "details?" } }`.

| Endpoint                                    | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `POST /api/auth/sign-up`                    | Create an account and establish a session       |
| `POST /api/auth/sign-in`                    | Sign in to an existing account                  |
| `POST /api/auth/password-reset/request`     | Email a reset link (always 200)                 |
| `POST /api/auth/password-reset/confirm`     | Set a new password with a reset token           |
| `POST /api/auth/change-password`            | Change password; revokes other sessions         |
| `GET /api/groups/search`                    | Open groups that fit a start, destination, time |
| `POST /api/groups`                          | Create a ride group and join it                 |
| `POST /api/sessions/:id/join`               | Join or update own waiting participation        |
| `POST /api/sessions/:id/match`              | Find and persist compatible ride groups         |
| `POST /api/sessions/:id/party`              | Group action: confirm, leave, start, complete   |
| `GET /api/sessions/:id/waiting-room`        | Roster, own destination and own group proposal  |
| `GET /api/health`                           | Liveness + database check (503 if DB is down)   |
| `GET /api/places?status=&kind=&limit=`      | List places                                     |
| `GET /api/places/:id`                       | Place with meeting points                       |
| `GET /api/sessions?placeId=&status=&limit=` | List sessions with participant counts           |
| `GET /api/sessions/:id`                     | Session detail                                  |

## Structure

```
src/app/            routes: (public) pages, api/ route handlers
src/modules/        feature modules: domain / application / infrastructure / schemas
src/db/             Drizzle client, schema, migrations
src/components/     ui (shadcn), layout, shared
src/lib/            env, http helpers, logger, composition root (services.ts)
scripts/            migrate, reset, seed, demo crew
tests/              Vitest unit and integration tests
docs/               architecture, domain model, decisions
```

## Architectural decisions

Modular monolith, server components by default, repositories isolate Drizzle, Zod validates input,
money in integer minor units and fares in basis points. See [docs/architecture.md](docs/architecture.md),
[docs/domain-model.md](docs/domain-model.md) and [docs/decisions/](docs/decisions/). Hackathon rules, submission checklist and judging rubric: [docs/hackathon-guide.md](docs/hackathon-guide.md).

## Multi-agent workflow

Agents working concurrently on this repo must use isolated Git worktrees (`.worktrees/<task-slug>`) and merge directly into `main` (no PRs) after passing `lint`, `typecheck`, and `test`. See [AGENTS.md](AGENTS.md) for the exact commands.
