import { z } from "zod";
const tripSchema = z.object({
  id: z.string(),
  date: z.string(),
  origin: z.string(),
  destination: z.string(),
  group: z.string(),
  total: z.number().int().nonnegative(),
  mine: z.number().int().nonnegative(),
  km: z.number().nonnegative(),
  companions: z.array(z.string()),
  ratings: z.record(z.string(), z.boolean()),
});
export type DemoTrip = z.infer<typeof tripSchema>;
export const SAMPLE_TRIPS: DemoTrip[] = [
  {
    id: "sample-1",
    date: "vie 16 oct · 23:40",
    origin: "Óvalo Gutiérrez",
    destination: "San Borja",
    group: "Grupo Morado 03",
    total: 3100,
    mine: 250,
    km: 18.6,
    companions: ["Jorge A.", "Camila L.", "Inés D."],
    ratings: {},
  },
  {
    id: "sample-2",
    date: "mié 14 oct · 22:15",
    origin: "Av. Javier Prado con Av. Arequipa",
    destination: "Pueblo Libre",
    group: "Grupo Ámbar 02",
    total: 2450,
    mine: 1250,
    km: 12.1,
    companions: ["Elena S.", "Renzo E.", "Héctor M."],
    ratings: { "Elena S.": true, "Renzo E.": true, "Héctor M.": true },
  },
];
const KEY = "jala:demo-trips:v1";
export function readDemoTrips(): DemoTrip[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return SAMPLE_TRIPS;
  const parsed = z.array(tripSchema).max(100).safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(
      "No pudimos leer el historial de ejemplo de este navegador.",
    );
  return parsed.data;
}
export function writeDemoTrips(trips: DemoTrip[]) {
  localStorage.setItem(KEY, JSON.stringify(trips.slice(0, 100)));
}
