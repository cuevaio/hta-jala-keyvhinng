/**
 * Acts as the FICTIONAL passengers of a session so one real person can demo the whole
 * journey alone: `bun run demo:crew <sessionId> confirm|start|complete`.
 * confirm: every fictional member of every party confirms; a fictional delegate first
 * posts a sample fare (S/ 30.00) if none is posted yet, since confirming needs one.
 * start/complete: the fictional delegate drives the trip (only when the party has one).
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
  command === "leave" ||
  command === "set_fare"
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
      fareMinor: schema.rideParties.fareMinor,
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
  const booker = members.find((m) => m.role === "delegate");
  if (command === "confirm" && booker && booker.fareMinor == null)
    await parties.apply(sessionId, booker.userId, "set_fare", 3000);
  for (const actor of actors)
    await parties.apply(sessionId, actor.userId, command as "confirm");
  console.log(`${command}: ${actors.length} fictional member(s) acted.`);
} finally {
  await client.end();
}
