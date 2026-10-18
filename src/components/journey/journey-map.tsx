"use client";
import { useEffect, useRef } from "react";
import type { SimGroup } from "@/modules/simulation/domain/simulation";
export const GROUP_COLORS = [
  "#c52d70",
  "#2563dc",
  "#2f8035",
  "#f45118",
  "#207b88",
  "#7040dc",
];
/** A plotted model route, intentionally separate from the live road-routing map. */
export function JourneyMap({
  groups,
  label,
  compact = false,
}: {
  groups: SimGroup[];
  label: string;
  compact?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const draw = () => {
      const width = node.clientWidth,
        height = node.clientHeight;
      const scale = window.devicePixelRatio || 1;
      node.width = width * scale;
      node.height = height * scale;
      const ctx = node.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, width, height);
      const points = groups.flatMap((g) => g.stops);
      const xs = [0, ...points.map((p) => p.x)],
        ys = [0, ...points.map((p) => p.y)];
      const minX = Math.min(...xs) - 2,
        maxX = Math.max(...xs) + 2,
        minY = Math.min(...ys) - 2,
        maxY = Math.max(...ys) + 2;
      const ratio = Math.min(
        (width - 50) / (maxX - minX),
        (height - 65) / (maxY - minY),
      );
      const project = (x: number, y: number) => [
        width / 2 + (x - (maxX + minX) / 2) * ratio,
        height / 2 - (y - (maxY + minY) / 2) * ratio,
      ];
      for (const group of groups) {
        const color = GROUP_COLORS[(group.id - 1) % GROUP_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(...(project(0, 0) as [number, number]));
        group.stops.forEach((p) =>
          ctx.lineTo(...(project(p.x, p.y) as [number, number])),
        );
        ctx.strokeStyle = color;
        ctx.lineWidth = compact ? 4 : 2;
        ctx.stroke();
        group.stops.forEach((p, i) => {
          const [x, y] = project(p.x, p.y);
          ctx.beginPath();
          ctx.arc(x, y, compact ? 13 : 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = compact ? 3 : 2;
          ctx.stroke();
          if (compact) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(i + 1), x, y + 4);
          }
        });
      }
      const [x, y] = project(0, 0);
      ctx.beginPath();
      ctx.arc(x, y, compact ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = "#12343b";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "600 12px sans-serif";
      ctx.textAlign = "center";
      if (compact) {
        ctx.fillStyle = "#fff";
        ctx.fillText("S", x, y + 4);
      } else {
        ctx.fillStyle = "#12343b";
        ctx.fillText(
          label,
          Math.min(width - 75, Math.max(75, x)),
          Math.min(height - 12, y + 28),
        );
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [groups, label, compact]);
  return (
    <canvas
      ref={canvas}
      className={`journey-map ${compact ? "journey-map-compact" : ""}`}
      role="img"
      aria-label={`Rutas simuladas desde ${label}; el detalle de cada parada aparece debajo.`}
    />
  );
}
