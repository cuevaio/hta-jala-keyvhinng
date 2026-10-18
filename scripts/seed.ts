/**
 * Seeds FICTIONAL demo data for local development. Safe to re-run: it wipes
 * and recreates only rows it owns (events flagged is_fictional, plus users it created).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const hours = (n: number) => n * 3_600_000;
const now = Date.now();

async function main() {
  await db.delete(schema.events).where(eq(schema.events.isFictional, true));
  await db.delete(schema.users).where(eq(schema.users.phone, "FICTIONAL"));

  const [concert] = await db
    .insert(schema.events)
    .values({
      slug: "concierto-demo-lima",
      name: "[DEMO] Noche de Cumbia Andina",
      description:
        "Evento FICTICIO de demostración. Un concierto imaginario en Lima para probar Jala.",
      venueName: "Estadio Demo (ficticio), San Borja",
      venueLatitude: -12.0897,
      venueLongitude: -77.0071,
      startsAt: new Date(now + hours(6)),
      endsAt: new Date(now + hours(10)),
      status: "active",
      isFictional: true,
    })
    .returning();

  await db.insert(schema.events).values({
    slug: "teatro-demo-lima",
    name: "[DEMO] Obra: El Último Micro",
    description: "Función de teatro FICTICIA para pruebas.",
    venueName: "Teatro Demo (ficticio), Miraflores",
    venueLatitude: -12.1211,
    venueLongitude: -77.0297,
    startsAt: new Date(now + hours(30)),
    endsAt: new Date(now + hours(33)),
    status: "scheduled",
    isFictional: true,
  });

  await db.insert(schema.meetingPoints).values([
    {
      eventId: concert.id,
      name: "Puerta 3 (Av. Aviación)",
      description: "Frente al paradero, junto al kiosco.",
      latitude: -12.0889,
      longitude: -77.0052,
    },
    {
      eventId: concert.id,
      name: "Grifo Demo (Javier Prado)",
      description: "Esquina del grifo, zona bien iluminada.",
      latitude: -12.0912,
      longitude: -77.0098,
    },
    {
      eventId: concert.id,
      name: "Parque Demo",
      description: "Entrada principal del parque.",
      latitude: -12.0868,
      longitude: -77.0105,
    },
  ]);

  const [session] = await db
    .insert(schema.sessions)
    .values({
      eventId: concert.id,
      name: "Salida 10:30 pm",
      status: "open",
      opensAt: new Date(now + hours(5)),
      closesAt: new Date(now + hours(11)),
      vehicleCapacity: 4,
    })
    .returning();

  const passengers = [
    {
      name: "Ana (ficticia)",
      label: "Miraflores, Parque Kennedy",
      lat: -12.1219,
      lng: -77.0297,
      pref: "delegate",
    },
    {
      name: "Luis (ficticio)",
      label: "Barranco, Puente de los Suspiros",
      lat: -12.1464,
      lng: -77.0206,
      pref: "passenger",
    },
    {
      name: "Rosa (ficticia)",
      label: "Surco, Jockey Plaza",
      lat: -12.0853,
      lng: -76.9753,
      pref: "passenger",
    },
    {
      name: "Diego (ficticio)",
      label: "San Isidro, Óvalo Gutiérrez",
      lat: -12.1006,
      lng: -77.0357,
      pref: "delegate",
    },
    {
      name: "Camila (ficticia)",
      label: "Magdalena, Plaza Bolívar",
      lat: -12.0897,
      lng: -77.0722,
      pref: "passenger",
    },
  ] as const;

  const users = await db
    .insert(schema.users)
    .values(
      passengers.map((p) => ({ displayName: p.name, phone: "FICTIONAL" })),
    )
    .returning();

  await db.insert(schema.sessionParticipants).values(
    users.map((user, i) => ({
      sessionId: session.id,
      userId: user.id,
      destinationLabel: passengers[i].label,
      latitude: passengers[i].lat,
      longitude: passengers[i].lng,
      delegatePreference: passengers[i].pref,
    })),
  );

  console.log(
    "Seeded fictional data: 2 events, 3 meeting points, 1 session, 5 passengers.",
  );
}

try {
  await main();
} finally {
  await client.end();
}
