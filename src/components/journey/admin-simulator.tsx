"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { ORIGINS, simulate } from "@/modules/simulation/domain/simulation";
import { apportionMinor } from "@/modules/payments/domain/fare-allocation";
import { GROUP_COLORS, JourneyMap } from "./journey-map";
function Choices<T extends string | number>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="sim-choices">
      <legend>{label}</legend>
      <div>
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
          >
            {v}
            {label === "Tolerancia de dirección" ? "°" : ""}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function AdminSimulator() {
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>(ORIGINS[0]);
  const [count, setCount] = useState(60),
    [capacity, setCapacity] = useState(4),
    [tolerance, setTolerance] = useState(40),
    [seed, setSeed] = useState(42);
  const result = useMemo(
    () => simulate(count, capacity, tolerance, seed, ORIGINS.indexOf(origin)),
    [count, capacity, tolerance, seed, origin],
  );
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="simulator">
      <header className="sim-hero">
        <Link href="/" className="sim-back">
          <ArrowLeft size={16} /> Volver a Jala
        </Link>
        <div className="sim-title">
          <div>
            <p className="j-eyebrow">
              <i /> JALA · PANEL DE VALIDACIÓN
            </p>
            <h1>
              Simulador de agrupamiento<span>.</span>
            </h1>
            <p>
              Simula muchas personas saliendo del mismo punto de la ciudad con
              destinos aleatorios en Lima,
              <br /> y observa cómo el algoritmo forma grupos, ordena paradas y
              reparte el costo.
            </p>
          </div>
          <button className="j-primary" onClick={() => setSeed((s) => s + 1)}>
            <RotateCw size={19} /> Regenerar escenario
          </button>
        </div>
      </header>
      <div className="sim-body">
        <div className="sim-controls">
          <Choices
            label="Punto de salida"
            values={ORIGINS}
            value={origin}
            onChange={setOrigin}
          />
          <Choices
            label="Personas saliendo"
            values={[24, 60, 120, 240]}
            value={count}
            onChange={setCount}
          />
          <Choices
            label="Máx. por vehículo"
            values={[3, 4]}
            value={capacity}
            onChange={setCapacity}
          />
          <Choices
            label="Tolerancia de dirección"
            values={[25, 40, 60]}
            value={tolerance}
            onChange={setTolerance}
          />
        </div>
        <div className="sim-stats" aria-live="polite">
          {[
            [
              "Taxis necesarios",
              result.groups.length,
              `en vez de ${count} taxis individuales`,
            ],
            [
              "Reducción de vehículos",
              pct(result.reduction),
              `${(count / result.groups.length).toFixed(1)} pasajeros por taxi en promedio`,
            ],
            [
              "Km-vehículo ahorrados",
              pct(result.savings),
              `${result.directKm.toFixed(0)} km → ${result.sharedKm.toFixed(0)} km (estimado)`,
            ],
            [
              "Desvío promedio",
              pct(result.averageDetour),
              "máximo 60% sobre la ruta directa",
            ],
          ].map(([label, value, detail]) => (
            <div key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
        <div className="sim-results">
          <section>
            <h2>Rutas por grupo</h2>
            <JourneyMap groups={result.groups} label={origin} />
            <p className="sim-note">
              Cada línea es un taxi compartido: sale del punto común y deja a
              cada pasajero en su destino.
            </p>
          </section>
          <section>
            <h2>Grupos formados · {result.groups.length}</h2>
            <div
              className="sim-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Detalle de grupos"
            >
              <table>
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Punto</th>
                    <th>Paradas</th>
                    <th>Km</th>
                    <th>Reparto %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.groups.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <span
                          className="sim-dot"
                          style={{ background: GROUP_COLORS[(g.id - 1) % 6] }}
                        />{" "}
                        G{String(g.id).padStart(2, "0")}
                      </td>
                      <td>
                        {String.fromCharCode(
                          65 + (Math.floor((g.id - 1) / 4) % 4),
                        )}
                      </td>
                      <td>{g.stops.map((p) => p.district).join(" → ")}</td>
                      <td>{g.km.toFixed(1)}</td>
                      <td>{apportionMinor(100, g.shares).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <p className="sim-note sim-method">
          Escenario simulado: destinos sintéticos en 18 distritos de Lima. Las
          distancias usan un modelo plano, no calles ni tráfico real. Agrupamos
          por dirección, ordenamos por distancia desde el origen y limitamos el
          desvío a 60%. Cada tramo se divide entre quienes siguen a bordo. Este
          panel público no muestra datos de usuarios ni administra viajes
          reales.
        </p>
      </div>
    </div>
  );
}
