/**
 * Acts as the FICTIONAL passengers of a session so one real person can demo the whole
 * journey alone: `bun run demo:crew <sessionId> confirm|start|complete`.
 * confirm: every fictional member of every party confirms. start/complete: the
 * fictional delegate drives the trip (only when the party has one).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { createPartyRepository } from "../src/modules/parties/infrastructure/party.repository";
import { PARTY_COMMANDS } from "../src/modules/parties/domain/party-lifecycle";

const [sessionId, command] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (
  !sessionId ||
  !PARTY_COMMANDS.includes(command as never) ||
  command === "leave"
)
  throw new Error("Usage: demo-crew <sessionId> confirm|start|complete");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });
const parties = createPartyRepository(db);

try {
  const members = await db
    .select({
      userId: schema.ridePartyMembers.userId,
      role: schema.ridePartyMembers.role,
    })
    .from(schema.ridePartyMembers)
    .innerJoin(
      schema.rideParties,
      eq(schema.rideParties.id, schema.ridePartyMembers.partyId),
    )
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.ridePartyMembers.userId),
    )
    .where(
      and(
        eq(schema.rideParties.sessionId, sessionId),
        eq(schema.users.phone, "FICTIONAL"),
      ),
    );
  const actors =
    command === "confirm"
      ? members
      : members.filter((m) => m.role === "delegate");
  for (const actor of actors)
    await parties.apply(sessionId, actor.userId, command as "confirm");
  console.log(`${command}: ${actors.length} fictional member(s) acted.`);
} finally {
  await client.end();
}
