# Jala

Real-time, event-based taxi-sharing coordination for **Hack The Andes 2026** (Lima, Perú).
People leaving concerts, plays and festivals are grouped with compatible destinations, a volunteer
delegate books a taxi through an existing service (e.g. Uber), and costs are split by recommended
percentages. Jala operates no vehicles and processes no payments in the MVP.

Status: **foundation only** – schema, read API, landing/event pages and the contracts for
matching, routing and fare allocation. The matching algorithm, auth, QR verification, payments and
provider integrations are not implemented. All seeded data is fictional.

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

| Variable              | Required | Default                 | Description                            |
| --------------------- | -------- | ----------------------- | -------------------------------------- |
| `DATABASE_URL`        | yes      | –                       | PostgreSQL connection string           |
| `NEXT_PUBLIC_APP_URL` | no       | `http://localhost:3000` | Public base URL                        |
| `LOG_LEVEL`           | no       | `info`                  | `debug` \| `info` \| `warn` \| `error` |

`.env.local` is git-ignored; never commit real credentials.

## Commands

| Command                           | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `bun dev`                         | Dev server                                 |
| `bun run build` / `bun run start` | Production build / serve                   |
| `bun run lint`                    | ESLint                                     |
| `bun run typecheck`               | `tsc --noEmit`                             |
| `bun run test`                    | Vitest unit tests                          |
| `bun run format`                  | Prettier                                   |
| `bun run db:up`                   | Start PostgreSQL via Docker Compose        |
| `bun run db:generate`             | Generate SQL migration from schema changes |
| `bun run db:migrate`              | Apply migrations                           |
| `bun run db:seed`                 | Reseed fictional data (re-runnable)        |

## API

All responses are `{ "data": ... }` or `{ "error": { "code", "message", "details?" } }`.

| Endpoint                                    | Description                                   |
| ------------------------------------------- | --------------------------------------------- |
| `GET /api/health`                           | Liveness + database check (503 if DB is down) |
| `GET /api/events?status=&limit=`            | List events                                   |
| `GET /api/events/:id`                       | Event with meeting points                     |
| `GET /api/sessions?eventId=&status=&limit=` | List sessions with participant counts         |
| `GET /api/sessions/:id`                     | Session detail                                |

## Structure

```
src/app/            routes: (public) pages, api/ route handlers
src/modules/        feature modules: domain / application / infrastructure / schemas
src/db/             Drizzle client, schema, migrations
src/components/     ui (shadcn), layout, shared
src/lib/            env, http helpers, logger, composition root (services.ts)
scripts/            migrate + seed
tests/unit/         Vitest tests
docs/               architecture, domain model, decisions
```

## Architectural decisions

Modular monolith, server components by default, repositories isolate Drizzle, Zod validates input,
money in integer minor units and fares in basis points. See [docs/architecture.md](docs/architecture.md),
[docs/domain-model.md](docs/domain-model.md) and [docs/decisions/](docs/decisions/). Hackathon rules, submission checklist and judging rubric: [docs/hackathon-guide.md](docs/hackathon-guide.md).
