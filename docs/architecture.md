# Architecture

Jala is a single Next.js 16 (App Router) application backed by PostgreSQL via Drizzle ORM.
There are no extra services; modules are separated by convention so they can be extracted later.

## Layers

```
app/ (routes, pages)  ──►  lib/services.ts (composition root)
                              │
                              ▼
modules/<feature>/application    services: use cases, throw domain errors
modules/<feature>/infrastructure repositories: the only code that touches Drizzle
modules/<feature>/domain         types, constants, pure rules; no framework imports
modules/<feature>/schemas        Zod schemas for external input
```

Rules:

1. `domain/` imports nothing from Next.js, Drizzle or other layers. It owns lifecycle values
   (e.g. `EVENT_STATUSES`); the DB enums in `src/db/schema/enums.ts` mirror them.
2. Route handlers only parse input (Zod), call an application service and format the response
   (`lib/http.ts`). Errors are mapped centrally (`handle()` / `fail()`).
3. Application services receive repositories as arguments (plain factory functions, no DI framework).
4. Server components call services directly; they do not call the HTTP API.
5. Client components are used only where browser interaction is required (none yet).

## Modules

| Module         | Status             | Responsibility                                                                    |
| -------------- | ------------------ | --------------------------------------------------------------------------------- |
| `events`       | implemented (read) | Events and their predefined meeting points                                        |
| `sessions`     | implemented (read) | Temporary matching pools per event                                                |
| `matching`     | contracts only     | `MatchingService`: candidates → candidate ride parties                            |
| `routing`      | contract + OSRM    | `RoutingProvider` contract, `RoutingError`, OSRM adapter (`ROUTING_BASE_URL`)     |
| `parties`      | domain only        | Ride party / member / ride types; `RideProviderAdapter` boundary for Uber etc.    |
| `payments`     | domain only        | Platform fee rule, segment-based fare allocation, basis-point helper           |
| `verification` | not created        | QR verification; add when there is code to put in it                              |

`routing` and `matching` never reference a mapping vendor. `RideProviderAdapter` keeps external
taxi providers behind an interface; the MVP has no implementation (delegates book manually).

## Cross-cutting

- `lib/env.ts` – Zod-validated environment, evaluated lazily so builds do not need a database.
- `lib/http.ts` – response envelope (`{ data }` / `{ error: { code, message } }`) and error mapping.
- `lib/errors.ts` – transport-agnostic errors thrown by services.
- `lib/logger.ts` – JSON logger honoring `LOG_LEVEL`.
- `db/` – Drizzle client, schema, SQL migrations (`src/db/migrations`).
