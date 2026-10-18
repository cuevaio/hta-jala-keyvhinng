# 0009 – Groups expire by deadline; a vanished booker cannot strand a ride

**Status:** accepted (implements RFC 0001 §4.3, with the changes below)

A group nobody finishes confirming, or a confirmed group nobody starts, used to live
forever and keep its members out of every other room. Groups now carry two deadlines on
`ride_parties`, set by the domain (`party-lifecycle.ts`):

- `confirm_by` = matched + 5 min. When missed, members who confirmed return to
  `waiting`; the others are released (`withdrawn`, photo deleted).
- `start_by` = confirmed + 30 min. When missed, everyone returns to `waiting`.

In both cases the group is `cancelled` and its member rows are deleted, exactly as in
ADR 0005: `ride_party_members.participant_id` is unique, so keeping them would block the
rematch. Outcome counts go to the `party.expired` log event instead of a `no_show` row.
Someone already waiting in another room keeps that seat and is released here, which also
keeps the one-waiting-seat index intact.

A started ride never expires: the people may really be in the taxi. Instead, 30 minutes
after the start any member may complete it, not only the booker.

**Where it runs.** Lazily, under the session row lock: room polls (one indexed read when
nothing is due), party commands and match requests sweep first. Expired groups stop
holding their members immediately, even before a sweep, so nobody waits for one to join
another room. No cron yet; a room nobody opens keeps its expired group until someone does,
which no one can see.

**Changes from the RFC:** 5 minutes to confirm instead of 10 (rooms now close 5 minutes
after departure); the start window counts from confirmation, not departure; the
delegate-loss fallback is new. Rows created before migration `0009` have no deadlines
and never expire.
