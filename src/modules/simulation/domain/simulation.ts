import { allocateBySegmentDistance } from "@/modules/payments/domain/fare-allocation";

export const ORIGINS = [
  "Parque Kennedy",
  "Óvalo Gutiérrez",
  "Javier Prado",
  "Plaza San Martín",
] as const;
export const DISTRICTS = [
  "Miraflores",
  "San Isidro",
  "Barranco",
  "Santiago de Surco",
  "San Borja",
  "La Molina",
  "Jesús María",
  "Lince",
  "Surquillo",
  "Chorrillos",
  "Ate",
  "San Miguel",
  "Pueblo Libre",
  "Los Olivos",
  "Cercado",
  "SJL",
  "Magdalena",
  "Breña",
];
export interface SimPoint {
  id: number;
  x: number;
  y: number;
  district: string;
}
export interface SimGroup {
  id: number;
  stops: SimPoint[];
  km: number;
  shares: number[];
  detours: number[];
}
const distance = (a: Pick<SimPoint, "x" | "y">, b: Pick<SimPoint, "x" | "y">) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const zero = { x: 0, y: 0 };

/** Synthetic planar distances: same model for direct and shared routes, never road estimates. */
export function simulate(
  count: number,
  capacity: number,
  tolerance: number,
  seed: number,
  origin = 0,
) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 240 ||
    ![3, 4].includes(capacity) ||
    ![25, 40, 60].includes(tolerance)
  )
    throw new RangeError("Invalid simulation configuration");
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const points = Array.from({ length: count }, (_, id): SimPoint => {
    const districtIndex = Math.floor(random() * DISTRICTS.length);
    const angle =
      (districtIndex / DISTRICTS.length) * Math.PI * 2 +
      (random() - 0.5) * 0.16 +
      origin * 0.3;
    const radius = 1 + random() * 17;
    return {
      id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      district: DISTRICTS[districtIndex],
    };
  });
  const remaining = [...points].sort(
    (a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x),
  );
  const groups: SimGroup[] = [];
  while (remaining.length) {
    const members = [remaining.shift()!];
    for (let i = 0; i < remaining.length && members.length < capacity;) {
      const first = Math.atan2(members[0].y, members[0].x);
      const angle = Math.atan2(remaining[i].y, remaining[i].x);
      const delta = Math.abs(
        Math.atan2(Math.sin(angle - first), Math.cos(angle - first)),
      );
      const trial = [...members, remaining[i]].sort(
        (a, b) => distance(zero, a) - distance(zero, b),
      );
      let traveled = 0;
      const compatible = trial.every((point, index) => {
        traveled += distance(index ? trial[index - 1] : zero, point);
        return traveled / distance(zero, point) <= 1.6 + 1e-9;
      });
      if (delta <= (tolerance / 180) * Math.PI && compatible)
        members.push(remaining.splice(i, 1)[0]);
      else i++;
    }
    const stops = members.sort((a, b) => distance(zero, a) - distance(zero, b));
    const legs = stops.map((p, i) => distance(i ? stops[i - 1] : zero, p));
    let km = 0;
    const detours = stops.map((p, i) => {
      km += legs[i];
      return km / distance(zero, p) - 1;
    });
    groups.push({
      id: groups.length + 1,
      stops,
      km,
      shares: allocateBySegmentDistance(legs),
      detours,
    });
  }
  const directKm = points.reduce((sum, p) => sum + distance(zero, p), 0);
  const sharedKm = groups.reduce((sum, g) => sum + g.km, 0);
  return {
    points,
    groups,
    directKm,
    sharedKm,
    reduction: 1 - groups.length / count,
    savings: 1 - sharedKm / directKm,
    averageDetour:
      groups.flatMap((g) => g.detours).reduce((a, b) => a + b, 0) / count,
  };
}
