# 0008 – Match automatically after room changes

**Status:** accepted

A matching round now runs on the server, after the response, whenever the room gains
someone who could be matched:

- after a join commits, on behalf of the person who joined;
- after a party dissolves (ADR 0005), on behalf of one of the members who returned to
  waiting.

Route handlers schedule the round with `after()` from `next/server`, through
`roomEvents` (`modules/notifications/application/room-events.ts`). It runs outside the
write's transaction, so a slow routing server or a failed round never delays or undoes
the join. `matchInBackground` retries twice when a concurrent join or match changed the
room between snapshot and commit, and logs instead of throwing. The "Buscar compañeros
ahora" button stays as a manual retry, for example after a routing outage.

**Why:** the product promise is "join, put the phone away, get told when there is a
group". With user-triggered matching, a group only formed when someone already looking at
the screen pressed a button, so nobody away from the screen ever got a group to be told
about. Running the round on each join makes group formation effectively real time without
a worker, queue or cron job, which Vercel functions would not host well.

**Tradeoffs:**

- Each join costs one routing round against `ROUTING_BASE_URL` (bounded by
  `MATCHING_BATCH_SIZE`). The public OSRM demo server is not meant for sustained traffic;
  run a dedicated instance before a real event.
- People are placed in a `forming` party without pressing anything. They still must
  confirm, and leaving dissolves the party, so nobody is committed to a trip by matching
  alone.
- A round that fails (routing down, three conflicting attempts) is not retried later.
  The next join or a manual press runs another round.
