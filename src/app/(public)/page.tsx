import Link from "next/link";
import { Car, MapPinned, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  { icon: Users, title: "Únete", text: "Elige tu evento y dinos a dónde vas." },
  {
    icon: MapPinned,
    title: "Te agrupamos",
    text: "Armamos grupos con rutas compatibles y un punto de encuentro.",
  },
  {
    icon: Car,
    title: "Comparte taxi",
    text: "Un delegado pide el viaje y todos dividen el costo.",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-4">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Sal del evento y <span className="text-primary">comparte taxi</span>.
        </h1>
        <p className="text-lg text-muted-foreground">
          Jala junta a personas que salen del mismo concierto o función hacia
          destinos cercanos, para que viajen más seguros y paguen menos.
        </p>
        <Link
          href="/events"
          className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
        >
          Ver eventos
        </Link>
      </section>

      <section aria-labelledby="como-funciona" className="space-y-4">
        <h2 id="como-funciona" className="text-xl font-bold">
          Cómo funciona
        </h2>
        <ol className="space-y-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4 rounded-xl border p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Tus primeros 5 viajes son gratis. Luego, una tarifa de servicio de S/
        0.10 por viaje. Los delegados no pagan.
      </section>
    </div>
  );
}
