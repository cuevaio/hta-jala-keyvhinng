# 0005 – Leaving a party dissolves it

**Status:** accepted

A party's route plan and fare shares are computed for one exact membership and stored
immutably. When anyone leaves before departure the party is cancelled, its member rows
are deleted, the leaver is withdrawn from the session and everyone else returns to
`waiting`. The next matching round builds a new party with a fresh route and shares.

**Why not keep the group and just re-confirm?** The remaining members would be shown a
route and percentages that no longer describe the trip, and shares would no longer be
fair for the shorter group. Rewriting a plan in place would also break the "every member
sees the same immutable plan" guarantee.

**Tradeoff:** one departure forces a re-match and fresh confirmations. Acceptable for
groups of two to four. The cancelled party row keeps its plan for audit; member rows are
removed because `ride_party_members.participant_id` is unique.
