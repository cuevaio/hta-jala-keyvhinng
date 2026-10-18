/**
 * Seeds FICTIONAL demo data for local development. Safe to re-run: it wipes
 * and recreates only rows it owns (places flagged is_fictional, plus users it created).
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
  await db.delete(schema.places).where(eq(schema.places.isFictional, true));
  await db.delete(schema.users).where(eq(schema.users.phone, "FICTIONAL"));

  const common = { isFictional: true, status: "active" as const };
  const [campus, mall, , stadium] = await db
    .insert(schema.places)
    .values([
      {
        ...common,
        slug: "universidad-demo-lima",
        name: "Universidad del Pacífico Demo",
        kind: "university",
        description:
          "Campus FICTICIO. Salida de las 10 p. m. cuando terminan las clases de noche.",
        address: "Av. Javier Prado Este, San Borja",
        latitude: -12.0897,
        longitude: -77.0071,
      },
      {
        ...common,
        slug: "mall-demo-lima",
        name: "Centro Comercial Larcomar Demo",
        kind: "mall",
        description: "Centro comercial FICTICIO frente al mar.",
        address: "Malecón de la Reserva, Miraflores",
        latitude: -12.1319,
        longitude: -77.0305,
      },
      {
        ...common,
        slug: "teatro-demo-lima",
        name: "Teatro Nacional Demo",
        kind: "venue",
        description:
          "Teatro FICTICIO para probar la salida después de una función.",
        address: "Av. Javier Prado Este 2225, San Borja",
        latitude: -12.0912,
        longitude: -76.9998,
      },
      {
        ...common,
        slug: "estadio-demo-lima",
        name: "Estadio Demo (concierto)",
        kind: "venue",
        description: "Estadio FICTICIO. Noche de Cumbia Andina imaginaria.",
        address: "Av. Aviación, San Borja",
        latitude: -12.0889,
        longitude: -77.0052,
      },
    ])
    .returning();

  await db.insert(schema.meetingPoints).values([
    {
      placeId: campus.id,
      name: "Puerta principal",
      description: "Frente a la garita, junto al paradero.",
      latitude: -12.0893,
      longitude: -77.0068,
    },
    {
      placeId: campus.id,
      name: "Biblioteca (lado Javier Prado)",
      description: "Esquina iluminada, a un minuto de la puerta.",
      latitude: -12.0901,
      longitude: -77.0079,
    },
    {
      placeId: mall.id,
      name: "Ingreso por el parque",
      description: "Junto a las escaleras mecánicas.",
      latitude: -12.1322,
      longitude: -77.0299,
    },
    {
      placeId: stadium.id,
      name: "Puerta 3 (Av. Aviación)",
      description: "Frente al paradero, junto al kiosco.",
      latitude: -12.0889,
      longitude: -77.0052,
    },
    {
      placeId: stadium.id,
      name: "Grifo Demo (Javier Prado)",
      description: "Esquina del grifo, zona bien iluminada.",
      latitude: -12.0912,
      longitude: -77.0098,
    },
  ]);

  const [session] = await db
    .insert(schema.sessions)
    .values({
      placeId: campus.id,
      name: "Salida demo abierta",
      status: "open",
      opensAt: new Date(now - hours(1)),
      closesAt: new Date(now + hours(11)),
      vehicleCapacity: 3,
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
    "Seeded fictional data: 2 places, 3 meeting points, 1 session, 5 passengers.",
  );
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(
    `\nDemo: sign up at ${base}/sign-up, then open ${base}/sessions/${session.id}\n` +
      "Join with a destination, press 'Buscar mi grupo', then confirm, start and finish the trip.",
  );
}

try {
  await main();
} finally {
  await client.end();
}
