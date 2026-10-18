# 0007 – Ride groups by route affinity

**Status:** accepted (refines 0006)

Jala works like a ride-hailing web app: your start can be your current location,
a specific address or a point selected on the map. Featured places are optional
shortcuts, not the only alternative to GPS. A session is now an open **ride group**
with a pickup, a destination anchor and a `departs_at`.

- Searching (`GET /api/groups/search`, public) returns open groups whose pickup is within
  1.5 km of the rider's start, whose destination anchor is within 3 km of their
  destination and that leave within 30 minutes of the requested time
  (`modules/sessions/domain/affinity.ts`). Best fit first.
- Joining re-checks the same spatial fit on the server. Creating a group
  (`POST /api/groups`) also joins the creator; its pickup snaps to the meeting point of an
  active place within 400 m of the start, otherwise it is the creator's own start.
- Departure: now, 15, 30 or 60 minutes. A group stays joinable until 5 minutes after
  `departs_at` (30 until 2026-10-18; shortened so riders and demos do not wait). A group holds at most 20 waiting people; matching still runs in rounds of 12.
- A person waits in one group at a time: joining another releases the first seat, and a
  live (forming, confirmed, in progress) party blocks joining elsewhere.
- Places stay as optional pickup anchors (`sessions.place_id` is nullable, `ON DELETE SET NULL`).
  Road matching, route plans, fare shares and the party lifecycle are unchanged; the
  pickup used for routing is `sessions.pickup_*`.
- Migration `0001_ride_groups` is additive and backfills existing rooms from their place.

**Tradeoff:** distance uses straight-line (haversine) radii for discovery; only matching
inside a group uses road time. Groups far apart by road but close in a straight line can be
offered and then fail to match.
