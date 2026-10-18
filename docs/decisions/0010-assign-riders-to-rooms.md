# 0010 – Assign riders to rooms instead of listing them

**Status:** accepted (refines 0007)

Planning a ride now ends in a room, not in a list of rooms. `POST /api/groups/assign`
(the create body) puts the rider in the best open room for their ride, or opens one
when none fits, and returns `{ id, created }`.

- Candidates are the same open rooms search returns (ADR 0007), but departure slack is
  15 minutes instead of 30 (`ASSIGN_DEPARTURE_WINDOW_MINUTES`): assigning accepts the
  room's departure, and someone leaving as soon as possible must not be parked for half
  an hour.
- A rider already waiting in a room that still fits stays there, so asking again never
  moves them away from people they were about to be grouped with.
- Assignments are serialized with a transaction-scoped advisory lock taken before the
  account lock. Two riders asking for the same route at the same moment share one room
  instead of each opening one and waiting alone. Nothing else takes that lock, so the
  lock order (assign → account → room) cannot deadlock.
- Joining an existing room schedules a background matching round (ADR 0008), exactly
  like a join.
- Rooms get a friendly name handed out in turn from a fixed list (`Sala Ceviche`,
  `Sala Lúcuma`, …), and remember who opened them (`sessions.created_by_user_id`,
  nullable, `ON DELETE SET NULL`). The creator sees a "Mía" tag; the creator id is never
  part of the public room summary.

`GET /api/groups/search`, `POST /api/groups` and `POST /api/sessions/:id/join` stay:
search is public and cheap, and joining by link (an invite) still needs the direct join.

**Why:** with a list, people did not know whether a room was their own, could not tell
rooms apart, and had to choose between near-identical candidates on a phone. On a busy
route the list also let two people open parallel rooms that never met.

**Tradeoffs:**

- One global advisory lock serializes every assignment. At hackathon traffic this is a
  few milliseconds of queueing; a real launch would key the lock by pickup area.
- Riders can no longer pick among several fitting rooms; the best fit wins.
