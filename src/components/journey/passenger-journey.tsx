"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Circle,
  Check,
  Clock3,
  Home,
  LocateFixed,
  LogOut,
  Mail,
  MapPin,
  QrCode,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  apportionMinor,
  allocateBySegmentDistance,
} from "@/modules/payments/domain/fare-allocation";
import { formatSoles } from "@/modules/payments/domain/fees";
import { parseFareMinor } from "@/modules/payments/domain/fare-input";
import type { GeoPoint } from "@/modules/places/domain/place";
import type { SimGroup } from "@/modules/simulation/domain/simulation";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/sessions/location-picker";
import { DEFAULT_MAP_CENTER } from "@/components/sessions/ride-form";
import { RideMap, type RideEnd } from "@/components/sessions/ride-map";
import {
  readDemoTrips,
  writeDemoTrips,
  SAMPLE_TRIPS,
  type DemoTrip,
} from "./demo-history";
import { JourneyMap } from "./journey-map";
import { SelfieCapture } from "@/components/sessions/selfie-capture";

type Screen =
  | "login"
  | "home"
  | "destination"
  | "selfie"
  | "group"
  | "chat"
  | "route"
  | "qr"
  | "verify"
  | "fare"
  | "saved"
  | "trips"
  | "detail"
  | "account";
type Message = { id: number; mine: boolean; body: string };
const SHARES = allocateBySegmentDistance([3.9, 1.4]);
const DEMO_CODE = "JALA-DEMO:ROSA04:JL-04-56A";
const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    mine: false,
    body: "¡Hola! Yo pido el taxi. ¿Nos vemos en el Punto C?",
  },
  { id: 2, mine: true, body: "Ya estoy saliendo, llego en 2 min." },
  { id: 3, mine: false, body: "Perfecto, te esperamos." },
];
const TITLES: Partial<Record<Screen, [string, string]>> = {
  destination: ["¿A dónde vas?", ""],
  selfie: ["Un paso más", "Tu selfie para que el grupo te reconozca"],
  group: ["Tu grupo está listo", "Grupo Rosa 04 · JL-04-56A"],
  chat: ["Chat del grupo", "Temporal · se cierra al encontrarse"],
  route: ["Ruta del grupo", "5.3 km · ~13 min · 2 pasajeros"],
  qr: ["Mi código", "Muéstralo en el punto de encuentro"],
  verify: ["Verificar pasajeros", ""],
  fare: ["Cerrar encuentro", "Ingresa la tarifa y empiecen el viaje"],
  saved: ["Viaje guardado", "Chat cerrado"],
  trips: ["Mis viajes", "Historial de grupos"],
  detail: ["Detalle del viaje", ""],
  account: ["Mi cuenta", "Tu ruta, nuestro viaje."],
};
const TABS = [
  { id: "home", label: "Inicio", Icon: Home },
  { id: "trips", label: "Mis viajes", Icon: Clock3 },
  { id: "account", label: "Cuenta", Icon: UserRound },
] as const;
function greeting(hour: number) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
function Avatar({ name, pink = false }: { name: string; pink?: boolean }) {
  return (
    <span className={`j-avatar ${pink ? "pink" : ""}`} aria-hidden="true">
      {name[0]?.toUpperCase()}
    </span>
  );
}
function Primary({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="j-primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
function SafetySheet({
  onClose,
  origin,
  destination,
}: {
  onClose: () => void;
  origin: string;
  destination: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function share() {
    const text = `Mi viaje en Jala: ${origin} → ${destination}. Grupo Rosa 04.`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Mi viaje en Jala", text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice("Resumen copiado. Puedes enviarlo a alguien de confianza.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice(
          "No pudimos compartir. Puedes copiar el resumen del viaje desde esta pantalla.",
        );
    }
  }
  return (
    <dialog
      className="j-safety"
      aria-labelledby="j-safety-title"
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>
        <header>
          <h2 id="j-safety-title">Kit de seguridad</h2>
          <button
            className="j-circle"
            onClick={onClose}
            aria-label="Cerrar kit de seguridad"
          >
            <X />
          </button>
        </header>
        <button className="j-safety-item" onClick={() => void share()}>
          <Shield />
          <span>
            <strong>Compartir mi viaje</strong>
            <small>Envía a tu familia el resumen de tu viaje.</small>
          </span>
        </button>
        <button
          className="j-safety-item"
          onClick={() =>
            setNotice(
              "Cuéntaselo a tu grupo en el chat. Si estás en peligro, llama al 105.",
            )
          }
        >
          <MapPin />
          <span>
            <strong>Reportar un problema</strong>
            <small>
              Avísanos si algo en el grupo o en el viaje no se siente seguro.
            </small>
          </span>
        </button>
        <a className="j-safety-item" href="tel:105">
          <Shield />
          <span>
            <strong>Llamar al 105</strong>
            <small>
              Policía Nacional del Perú. La llamada se abre en tu teléfono; Jala
              no envía tu ubicación.
            </small>
          </span>
        </a>
        {notice && (
          <p role="status" className="j-notice">
            {notice}
          </p>
        )}
      </div>
    </dialog>
  );
}

export function PassengerJourney() {
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<PickedLocation | null>(null);
  const [destination, setDestination] = useState<PickedLocation | null>(null);
  const [mapEnd, setMapEnd] = useState<RideEnd>("origin");
  const [mapFocus, setMapFocus] = useState<GeoPoint | null>(null);
  const [departure, setDeparture] = useState(0);
  const [delegate, setDelegate] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [meeting, setMeeting] = useState("Punto C · Parque Kennedy");
  const [changingMeeting, setChangingMeeting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [fare, setFare] = useState("28.50");
  const [saved, setSaved] = useState<DemoTrip | null>(null);
  const [trips, setTrips] = useState<DemoTrip[]>(SAMPLE_TRIPS);
  const [selected, setSelected] = useState<DemoTrip>(SAMPLE_TRIPS[0]);
  const [safety, setSafety] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const fareMinor = parseFareMinor(fare);
  const split = fareMinor !== null ? apportionMinor(fareMinor, SHARES) : null;
  const nav = (next: Screen) => {
    setError("");
    setScreen(next);
  };
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (screen === "chat")
      chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, screen]);
  // Short names for the itinerary: the first part of the chosen address.
  const originName = origin?.label.split(",")[0].trim() ?? "";
  const destinationName = destination?.label.split(",")[0].trim() ?? "";
  const routeReady = Boolean(
    origin?.point &&
    origin.label.trim().length >= 3 &&
    destination?.point &&
    destination.label.trim().length >= 3,
  );
  function changeOrigin(next: PickedLocation | null) {
    setOrigin(next);
    // With the start known, the next tap on the map is most likely the destination.
    if (next?.point && !origin?.point && !destination?.point)
      setMapEnd("destination");
  }
  function pickOnMap(end: RideEnd, point: GeoPoint) {
    if (end === "origin") changeOrigin({ point, label: origin?.label ?? "" });
    else setDestination({ point, label: destination?.label ?? "" });
  }
  const groupRoute: SimGroup[] = [
    {
      id: 1,
      stops: [
        { id: 1, x: 1.2, y: -3.7, district: destinationName || "Barranco" },
        { id: 2, x: 2.4, y: -4.4, district: destinationName || "Barranco" },
      ],
      km: 5.3,
      shares: SHARES,
      detours: [0, 0.05],
    },
  ];
  function loadTrips() {
    try {
      setTrips(readDemoTrips());
    } catch {
      setError("No pudimos cargar tu historial. Inténtalo otra vez.");
    }
    setScreen("trips");
  }
  function send(body: string) {
    if (!body.trim()) return;
    setMessages((current) => [
      ...current,
      {
        id: (current.at(-1)?.id ?? 0) + 1,
        mine: true,
        body: body.trim().slice(0, 500),
      },
    ]);
    setDraft("");
  }
  function startTrip() {
    if (!fareMinor || !split || !verified) return;
    const trip: DemoTrip = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleString("es-PE", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      }),
      origin: originName,
      destination: destinationName,
      group: "Grupo Rosa 04",
      total: fareMinor,
      mine: split[0],
      km: 5.3,
      companions: ["Gabriela I."],
      ratings: {},
    };
    try {
      writeDemoTrips([trip, ...readDemoTrips()]);
    } catch {
      setError("No pudimos guardar el viaje en tu historial.");
    }
    setSaved(trip);
    setSelfie(null);
    setMessages([]);
    setScreen("saved");
  }
  function rate(person: string, value: boolean) {
    const next = {
      ...selected,
      ratings: { ...selected.ratings, [person]: value },
    };
    try {
      const list = readDemoTrips().map((t) => (t.id === next.id ? next : t));
      writeDemoTrips(list);
      setTrips(list);
      setSelected(next);
      setError("");
    } catch {
      setError("No pudimos guardar tu respuesta. Inténtalo otra vez.");
    }
  }
  const displayName = name.trim() || "Flor";
  const title = TITLES[screen];
  const tabs = TABS.some((tab) => tab.id === screen);
  const pendingRatings = trips.some((t) =>
    t.companions.some((p) => !(p in t.ratings)),
  );
  const back: Partial<Record<Screen, Screen>> = {
    destination: "home",
    selfie: "destination",
    group: "home",
    chat: "group",
    route: "group",
    qr: "group",
    verify: "group",
    fare: "verify",
    detail: "trips",
  };
  const resetRide = (
    end: RideEnd = destination?.point ? "origin" : "destination",
  ) => {
    setMapEnd(origin?.point ? end : "origin");
    setVerified(false);
    setSelfie(null);
    setMessages(INITIAL_MESSAGES);
    setSaved(null);
    setFare("28.50");
    setLeaving(false);
    nav("destination");
  };

  const signedIn = screen !== "login";
  // Home and login lead with the brand bar; every other screen leads with its own title.
  // On desktop the brand bar is always present and carries the tabs.
  const branded = screen === "home" || screen === "login";
  const width =
    branded || screen === "destination"
      ? "wide"
      : screen === "chat"
        ? "chat"
        : "narrow";
  const tabLinks = TABS.map(({ id, label, Icon }) => (
    <button
      key={id}
      aria-current={screen === id ? "page" : undefined}
      onClick={() => (id === "trips" ? loadTrips() : nav(id))}
    >
      <Icon size={22} aria-hidden="true" />
      {id === "trips" && pendingRatings && (
        <span className="j-nav-badge" aria-label="calificación pendiente">
          1
        </span>
      )}
      <span>{label}</span>
    </button>
  ));
  const signOut = () => {
    setSelfie(null);
    setMessages([]);
    setName("");
    nav("login");
  };

  return (
    <div
      className={`passenger-app ${tabs ? "j-has-tabs" : ""}`}
      data-screen={screen}
    >
      <header
        className={`j-appbar ${branded ? "" : "j-appbar-desktop-only"} ${screen === "login" ? "j-appbar-plain" : ""}`}
      >
        <div className="j-appbar-inner">
          <Link href="/" aria-label="Jala, inicio" className="j-logo">
            <Image
              src="/jala-logo.png"
              alt="jala"
              width={88}
              height={41}
              priority
            />
          </Link>
          {signedIn && (
            <>
              <nav className="j-topnav" aria-label="Principal">
                {tabLinks}
              </nav>
              <div className="j-appbar-actions">
                <button
                  className="j-avatar"
                  onClick={() => nav("account")}
                  aria-label="Abrir mi cuenta"
                >
                  {displayName[0]?.toUpperCase()}
                </button>
                <button
                  className="j-circle"
                  onClick={signOut}
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      <main id="contenido" className={`j-main j-main-${width}`}>
        {!branded && (
          <header className="j-page-header">
            {back[screen] && (
              <button
                className="j-circle"
                onClick={() => nav(back[screen]!)}
                aria-label="Volver"
              >
                <ArrowLeft size={21} />
              </button>
            )}
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {title?.[0]}
              </h1>
              <p>
                {screen === "destination"
                  ? originName
                    ? `Saliendo desde ${originName}`
                    : "Elige tu punto de partida y tu destino"
                  : screen === "verify"
                    ? `${verified ? 1 : 0} de 1 verificados`
                    : screen === "detail"
                      ? `${selected.date} · ${selected.group}`
                      : title?.[1]}
              </p>
            </div>
          </header>
        )}
        {error && (
          <p className="j-error" role="alert">
            {error}
          </p>
        )}
        <div className={`j-content j-screen-${screen}`}>
          {screen === "login" && (
            <>
              <section className="j-col-main">
                <p className="j-eyebrow">
                  <i /> COMPARTE EL REGRESO
                </p>
                <h1 className="j-hero-title" ref={heading} tabIndex={-1}>
                  Sal en grupo.
                  <br />
                  <em>Llega a tu puerta.</em>
                </h1>
                <p className="j-intro">
                  Te juntamos con personas que salen cerca de ti y van hacia tu
                  zona. Cada quien paga su tramo.
                </p>
              </section>
              <section className="j-col-side j-login-card">
                <h2>Ingresa a tu cuenta</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    nav("home");
                  }}
                >
                  <label className="j-field">
                    Tu nombre
                    <input
                      required
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cómo te verá tu grupo"
                      autoComplete="given-name"
                    />
                  </label>
                  <Primary>
                    Continuar <ArrowRight size={20} />
                  </Primary>
                </form>
                <div className="j-divider">o</div>
                <Link className="j-secondary" href="/sign-in?next=%2Fride">
                  <Mail size={21} /> Continuar con correo
                </Link>
              </section>
            </>
          )}

          {screen === "home" && (
            <>
              <section className="j-col-main">
                <p className="j-eyebrow">
                  <i /> COMPARTE EL REGRESO
                </p>
                <h1 className="j-home-title" ref={heading} tabIndex={-1}>
                  {greeting(new Date().getHours())}, {displayName.split(" ")[0]}
                  .
                  <br />
                  <em>¿Volvemos juntos?</em>
                </h1>
                <p className="j-intro">
                  Comparte un taxi con personas que salen cerca de ti y van
                  hacia tu zona. Cada quien llega a su puerta y paga su tramo.
                </p>
                <div className="j-search-card">
                  <div>
                    <div className="j-origin-label">
                      <strong>
                        <Circle size={10} aria-hidden="true" /> Punto de partida
                      </strong>
                      <button onClick={() => resetRide("origin")}>
                        <LocateFixed size={16} /> Usar mi ubicación
                      </button>
                    </div>
                    <button
                      className="j-origin-preview"
                      onClick={() => resetRide("origin")}
                    >
                      {origin?.label || "¿Desde dónde sales?"}
                    </button>
                  </div>
                  <div>
                    <button
                      className="j-destination-preview"
                      onClick={() => resetRide("destination")}
                    >
                      <span>
                        <MapPin size={17} /> ¿A dónde vas?
                      </span>
                      <strong>
                        {destination?.label || "Distrito, calle o lugar"}
                      </strong>
                    </button>
                    <Primary onClick={() => resetRide()}>
                      Buscar compañeros de viaje <ArrowRight size={21} />
                    </Primary>
                  </div>
                </div>
                <p className="j-privacy">
                  <Shield size={18} /> Tu destino exacto solo se comparte con tu
                  grupo de viaje.
                </p>
              </section>
              <section className="j-col-side">
                <div className="j-promo">
                  <p>Tu ruta, nuestro viaje.</p>
                  <h2>4 viajes sin comisión</h2>
                  <span>Tus primeros 5 son gratis</span>
                </div>
                <div className="j-shortcuts">
                  {["Casa", "Trabajo", "Otros"].map((t) => (
                    <button key={t} onClick={() => resetRide("destination")}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="j-section-heading">
                  <div>
                    <p className="j-eyebrow">AHORA MISMO</p>
                    <h2>Salas de espera cerca</h2>
                  </div>
                  <Link href="/ride">
                    Crear sala <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
                <Link href="/ride" className="j-room-card">
                  <span>
                    <strong>Encuentra personas hacia tu zona</strong>
                    <small>Explora las salas abiertas o crea la tuya.</small>
                  </span>
                  <ArrowRight size={20} />
                </Link>
              </section>
            </>
          )}

          {screen === "destination" && (
            <form
              className="j-trip"
              onSubmit={(e) => {
                e.preventDefault();
                if (routeReady) nav("selfie");
              }}
            >
              <div className="j-trip-fields">
                <LocationPicker
                  id="j-origin"
                  end="origin"
                  value={origin}
                  onChange={changeOrigin}
                  onActivate={() => setMapEnd("origin")}
                  onFocusPoint={setMapFocus}
                />
                <LocationPicker
                  id="j-destination"
                  end="destination"
                  value={destination}
                  onChange={setDestination}
                  onActivate={() => setMapEnd("destination")}
                  onFocusPoint={setMapFocus}
                />
              </div>
              <div className="j-trip-map">
                <div
                  className="map-mode"
                  role="group"
                  aria-label="Al tocar el mapa marcas"
                >
                  <span aria-hidden="true">Tocar el mapa marca</span>
                  {(["origin", "destination"] as const).map((end) => (
                    <button
                      key={end}
                      type="button"
                      aria-pressed={mapEnd === end}
                      onClick={() => setMapEnd(end)}
                    >
                      {end === "origin" ? "Partida" : "Destino"}
                    </button>
                  ))}
                </div>
                <RideMap
                  center={origin?.point ?? DEFAULT_MAP_CENTER}
                  origin={origin?.point ?? null}
                  destination={destination?.point ?? null}
                  active={mapEnd}
                  focus={mapFocus}
                  onPick={pickOnMap}
                />
              </div>
              <div className="j-trip-details">
                <fieldset className="j-options">
                  <legend>¿Cuándo sales?</legend>
                  <div>
                    {[0, 15, 30, 60].map((n) => (
                      <button
                        type="button"
                        key={n}
                        aria-pressed={departure === n}
                        onClick={() => setDeparture(n)}
                      >
                        {n === 0 ? "Ahora" : n === 60 ? "1 hora" : `${n} min`}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="j-options j-role-options">
                  <legend>¿Puedes reservar el taxi?</legend>
                  <div>
                    <button
                      type="button"
                      aria-pressed={!delegate}
                      onClick={() => setDelegate(false)}
                    >
                      <strong>Voy de pasajero</strong>
                      <small>Prefiero que otra persona reserve</small>
                    </button>
                    <button
                      type="button"
                      aria-pressed={delegate}
                      onClick={() => setDelegate(true)}
                    >
                      <strong>Puedo reservar</strong>
                      <small>Pido el taxi y no pago comisión</small>
                    </button>
                  </div>
                </fieldset>
                <Primary disabled={!routeReady}>Buscar grupo</Primary>
              </div>
            </form>
          )}

          {screen === "selfie" && (
            <>
              <div className="j-match-banner">
                <span className="j-pink-dot" /> Encontramos tu grupo: 2 personas
                · Grupo Rosa 04
              </div>
              <SelfieCapture
                value={selfie}
                onChange={setSelfie}
                buttons={{ primary: "j-primary", secondary: "j-secondary" }}
                hint={
                  <p className="j-selfie-copy">
                    Antes de confirmar el grupo, toma una selfie. Solo la verán
                    tus compañeros en el chat temporal para reconocerte, y se
                    borra cuando el chat se cierra.
                  </p>
                }
                confirm={
                  <Primary onClick={() => nav("group")}>
                    <Check size={21} /> Confirmar y ver mi grupo
                  </Primary>
                }
              />
              {!selfie && (
                <button
                  className="j-secondary"
                  onClick={() => {
                    setSelfie("/demo/example-selfie.jpg");
                    nav("group");
                  }}
                >
                  Usar foto de ejemplo
                </button>
              )}
              <p className="j-fine">
                {departure ? `Salida en ${departure} min` : "Salida ahora"} ·{" "}
                {delegate ? "Puedes reservar" : "Vas de pasajero"}
              </p>
            </>
          )}

          {screen === "group" && (
            <>
              <div className="j-group-card">
                <div>
                  <Avatar name="Gabriela" pink />
                  <span>
                    <strong>{delegate ? displayName : "Gabriela I."}</strong>
                    <small>Delegado · reservará el taxi</small>
                  </span>
                  <button
                    className="j-qr-button"
                    aria-label="Mostrar mi código QR"
                    onClick={() => nav("qr")}
                  >
                    <QrCode size={25} />
                  </button>
                </div>
                <div>
                  <span className="j-pin-box">
                    <MapPin size={25} />
                  </span>
                  <span>
                    <strong>{meeting}</strong>
                    <small>Encuéntrense en el lado sur</small>
                  </span>
                  <span className="j-minutes">
                    <b>5</b>
                    <small>min</small>
                  </span>
                </div>
              </div>
              <button className="j-chat-entry" onClick={() => nav("chat")}>
                <div className="j-avatar-stack">
                  <Avatar name={displayName} />
                  <Avatar name="Gabriela" pink />
                </div>
                <span>
                  <strong>Chat del grupo</strong>
                  <small>Selfies y punto de encuentro · temporal</small>
                </span>
                <b>{messages.length}</b>
              </button>
              <div className="j-section-heading">
                <h2>Itinerario del viaje</h2>
                <button onClick={() => nav("route")}>Ver mapa</button>
              </div>
              <ol className="j-itinerary">
                <li>
                  <span className="j-stop j-stop-start" />
                  <div>
                    <strong>Salida · {originName}</strong>
                    <small>{meeting} · 5 min a pie</small>
                  </div>
                </li>
                <li>
                  <span className="j-stop j-stop-mine">1</span>
                  <div>
                    <strong>Tú — {destinationName}</strong>
                    <small>~10 min · sin desvío</small>
                  </div>
                  <b>{Math.round(SHARES[0] / 100)}%</b>
                </li>
                <li>
                  <span className="j-stop">2</span>
                  <div>
                    <strong>
                      Gabriela I. {delegate ? "" : "· delegado "}—{" "}
                      {destinationName}
                    </strong>
                    <small>~13 min · +5% desvío</small>
                  </div>
                  <b>{Math.round(SHARES[1] / 100)}%</b>
                </li>
              </ol>
              <div className="j-verification">
                <div>
                  <strong>Verificar y encontrarse</strong>
                  <small>{verified ? 1 : 0} de 1 verificados con QR</small>
                </div>
                <button onClick={() => nav("verify")}>
                  {verified ? "Continuar" : "Escanear"}
                </button>
              </div>
              <div className="j-group-actions">
                <button
                  className="j-secondary"
                  onClick={() => setLeaving(true)}
                >
                  Salir del grupo
                </button>
                <button className="j-dark" onClick={() => setSafety(true)}>
                  Kit de seguridad <Shield size={20} />
                </button>
              </div>
              {leaving && (
                <div className="j-notice" role="alert">
                  <strong>¿Salir del grupo?</strong>
                  <p>Se borrarán los mensajes y tu selfie de esta sesión.</p>
                  <div className="j-row">
                    <button
                      className="j-secondary"
                      onClick={() => setLeaving(false)}
                    >
                      Quedarme
                    </button>
                    <button
                      className="j-primary"
                      onClick={() => {
                        setSelfie(null);
                        setMessages([]);
                        setLeaving(false);
                        nav("home");
                      }}
                    >
                      Sí, salir
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {screen === "chat" && (
            <>
              <div className="j-meeting-banner">
                <MapPin size={22} />
                <span>
                  <small>Punto de encuentro</small>
                  <strong>{meeting}</strong>
                </span>
                <button onClick={() => setChangingMeeting((v) => !v)}>
                  Cambiar
                </button>
              </div>
              {changingMeeting && (
                <fieldset className="j-meeting-choices">
                  <legend>Elige el punto de encuentro</legend>
                  {[
                    "Punto A · Parque Kennedy",
                    "Punto B · Parque Kennedy",
                    "Punto C · Parque Kennedy",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setMeeting(p);
                        setChangingMeeting(false);
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </fieldset>
              )}
              <div
                className="j-chat-log"
                role="log"
                aria-label="Mensajes del grupo"
                aria-live="polite"
              >
                <p className="j-chat-notice">
                  Este chat y las selfies se borran cuando todos se encuentran.
                </p>
                <div className="j-selfie-message">
                  <small>Gabriela I. envió su selfie</small>
                  <Avatar name="Gabriela" pink />
                </div>
                {selfie && (
                  <div className="j-selfie-message mine">
                    <small>Tú enviaste tu selfie</small>
                    <Image
                      src={selfie}
                      width={145}
                      height={165}
                      alt="Tu selfie temporal"
                      unoptimized
                    />
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`j-message ${m.mine ? "mine" : ""}`}
                  >
                    <small>{m.mine ? "Tú" : "Gabriela I."}</small>
                    <p>{m.body}</p>
                  </div>
                ))}
                <div ref={chatEnd} />
              </div>
              <div className="j-chat-composer">
                <div className="j-quick-replies">
                  {[
                    "Ya estoy en el punto",
                    "Llego en 2 min",
                    "Llevo casaca negra",
                  ].map((text) => (
                    <button key={text} onClick={() => send(text)}>
                      {text}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(draft);
                  }}
                >
                  <input
                    aria-label="Mensaje al grupo"
                    placeholder="Escribe al grupo..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={500}
                  />
                  <button
                    className="j-dark"
                    disabled={!draft.trim()}
                    aria-label="Enviar mensaje"
                  >
                    <ArrowRight />
                  </button>
                </form>
              </div>
            </>
          )}

          {screen === "route" && (
            <>
              <div className="j-route-chart">
                <span>2 paradas · orden óptimo</span>
                <JourneyMap groups={groupRoute} label={originName} compact />
              </div>
              {[displayName, "Gabriela I."].map((person, i) => (
                <div
                  key={person + i}
                  className={`j-route-stop ${i === 0 ? "selected" : ""}`}
                >
                  <span
                    className={`j-stop ${i === 0 ? "j-stop-mine" : "j-stop-start"}`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <strong>
                      {i === 0 ? "Tú" : person} — {destinationName}
                    </strong>
                    <small>
                      ~{i === 0 ? 10 : 13} min · {i === 0 ? 3.9 : 5.3} km
                      recorridos
                    </small>
                  </span>
                  <b>{Math.round(SHARES[i] / 100)}%</b>
                </div>
              ))}
            </>
          )}

          {screen === "qr" && (
            <div className="j-qr-screen">
              <span className="j-group-badge">
                <span className="j-pink-dot" /> Grupo Rosa 04
              </span>
              <div className="j-qr-frame">
                <QRCodeCanvas
                  value={DEMO_CODE}
                  size={280}
                  marginSize={4}
                  fgColor="#092126"
                  title="Código QR de Grupo Rosa 04"
                />
              </div>
              <h2>JL-04-56A</h2>
              <p>
                El delegado lo escanea para confirmar que perteneces a este
                grupo.
              </p>
              <button className="j-secondary" onClick={() => nav("verify")}>
                Verificar a mi grupo
              </button>
            </div>
          )}

          {screen === "verify" && (
            <>
              <div className="j-scan-preview">
                <QrCode size={120} strokeWidth={1} />
                <p>Verifica el código de cada pasajero</p>
              </div>
              <div className="j-verify-person">
                <Avatar name="Gabriela" />
                <span>
                  <strong>Gabriela I.</strong>
                  <small>{destinationName}</small>
                </span>
                <span
                  className={verified ? "j-success-pill" : "j-pending-pill"}
                >
                  {verified ? "Verificado" : "Pendiente"}
                </span>
              </div>
              {verified ? (
                <>
                  <p className="j-success">
                    Todos verificados. Ya pueden pedir el taxi con las paradas
                    en el orden indicado.
                  </p>
                  <Primary onClick={() => nav("fare")}>
                    Todos nos encontramos
                  </Primary>
                </>
              ) : (
                <>
                  <p className="j-fine">
                    Ingresa el código que muestra cada pasajero debajo de su QR.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (
                        scanCode.trim() !== "JL-04-56A" &&
                        scanCode.trim() !== DEMO_CODE
                      ) {
                        setError("Este código no pertenece a tu grupo.");
                        return;
                      }
                      setVerified(true);
                      setError("");
                    }}
                  >
                    <label className="j-field">
                      Código del pasajero
                      <input
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        placeholder="JL-04-56A"
                        required
                      />
                    </label>
                    <Primary>Verificar código</Primary>
                  </form>
                </>
              )}
            </>
          )}

          {screen === "fare" && (
            <>
              <label className="j-field">
                Tarifa que muestra la app de taxi
                <div className="j-fare-input">
                  <span>S/</span>
                  <input
                    aria-label="Tarifa total del taxi en soles"
                    inputMode="decimal"
                    value={fare}
                    onChange={(e) => setFare(e.target.value)}
                    maxLength={8}
                  />
                </div>
              </label>
              {split &&
                ["Tú", "Gabriela I."].map((person, i) => (
                  <div
                    key={person}
                    className={`j-fare-person ${i === 0 ? "selected" : ""}`}
                  >
                    <span>
                      <strong>
                        {person}
                        {delegate
                          ? i === 0
                            ? " · delegado"
                            : ""
                          : i === 1
                            ? " · delegado"
                            : ""}
                      </strong>
                      <small>
                        {Math.round(SHARES[i] / 100)}% del costo ·{" "}
                        {destinationName}
                      </small>
                    </span>
                    <b>{formatSoles(split[i])}</b>
                  </div>
                ))}
              {!fareMinor && (
                <p className="j-error">
                  Ingresa una tarifa válida mayor que cero.
                </p>
              )}
              <div className="j-commission">
                <small>Comisión Jala para ti</small>
                <strong>S/ 0.00 · viaje gratis 2 de 5</strong>
              </div>
              <p className="j-fare-copy">
                Al iniciar el viaje, el chat temporal se cierra y las selfies se
                borran. El viaje queda guardado en tu historial con las
                personas, la ruta y el monto.
              </p>
              <Primary disabled={!fareMinor || !verified} onClick={startTrip}>
                Iniciar viaje y cerrar chat
              </Primary>
            </>
          )}

          {screen === "saved" && saved && (
            <>
              <div className="j-saved-intro">
                <span>
                  <Check size={38} />
                </span>
                <h2>¡Buen viaje!</h2>
                <p>
                  El chat del grupo se cerró y las selfies se borraron.
                  Guardamos tu viaje en tu historial.
                </p>
              </div>
              <div className="j-saved-card">
                <small>{saved.date}</small>
                <strong>
                  {saved.origin.split(",")[0]} → {saved.destination}
                </strong>
                <span className="j-group-badge">{saved.group}</span>
                <TripStats trip={saved} />
                <p>Con {saved.companions.join(", ")}</p>
              </div>
              <div className="j-bottom-actions">
                <Primary onClick={loadTrips}>Ver en mis viajes</Primary>
                <button className="j-secondary" onClick={() => nav("home")}>
                  Ir al inicio
                </button>
              </div>
            </>
          )}

          {screen === "trips" && (
            <>
              <div className="j-trip-list">
                {trips.map((trip, i) => (
                  <button
                    className="j-trip-card"
                    key={trip.id}
                    onClick={() => {
                      setSelected(trip);
                      nav("detail");
                    }}
                  >
                    <div>
                      <span>
                        <small>{trip.date}</small>
                        <strong>
                          {trip.origin} → {trip.destination}
                        </strong>
                      </span>
                      <b>
                        {formatSoles(trip.total)} · tú {formatSoles(trip.mine)}
                      </b>
                    </div>
                    <p>
                      <span
                        className="j-pink-dot"
                        style={{ background: i % 2 ? "#b55f00" : "#7040dc" }}
                      />{" "}
                      Con {trip.companions.join(", ")}
                    </p>
                    <span
                      className={
                        trip.companions.every((p) => p in trip.ratings)
                          ? "j-success-pill"
                          : "j-rate-pill"
                      }
                    >
                      {trip.companions.every((p) => p in trip.ratings)
                        ? "Calificado"
                        : "Califica a tus acompañantes"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="j-history-note">
                Los chats de grupo no se guardan. Solo conservamos personas,
                ruta y monto.
              </p>
            </>
          )}

          {screen === "detail" && (
            <>
              <TripStats trip={selected} />
              <div className="j-detail-route">
                <p>
                  <span className="j-stop j-stop-start">S</span> Salida ·{" "}
                  {selected.origin}
                </p>
                <p>
                  <span className="j-stop j-stop-mine">1</span> Tú —{" "}
                  {selected.destination}
                  <b>{formatSoles(selected.mine)}</b>
                </p>
                {selected.companions.map((person, i) => (
                  <p key={person}>
                    <span className="j-stop">{i + 2}</span>
                    {person}
                  </p>
                ))}
              </div>
              <h2>Tus acompañantes</h2>
              {selected.companions.map((person) => (
                <div className="j-rating-card" key={person}>
                  <div>
                    <Avatar name={person} />
                    <p>¿Volverías a viajar con {person}?</p>
                  </div>
                  <div>
                    {[true, false].map((value) => (
                      <button
                        key={String(value)}
                        aria-pressed={selected.ratings[person] === value}
                        onClick={() => rate(person, value)}
                      >
                        {value ? "Sí" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {screen === "account" && (
            <>
              <div className="j-account">
                <Avatar name={displayName} />
                <h2>{displayName}</h2>
              </div>
              <Link href="/sign-in?next=%2Fride" className="j-primary">
                <Mail size={20} /> Entrar con correo
              </Link>
              <button className="j-secondary" onClick={signOut}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </main>
      {tabs && (
        <nav className="j-bottom-nav" aria-label="Principal">
          {tabLinks}
        </nav>
      )}
      {safety && (
        <SafetySheet
          origin={originName}
          destination={destinationName}
          onClose={() => setSafety(false)}
        />
      )}
    </div>
  );
}
function TripStats({ trip }: { trip: DemoTrip }) {
  return (
    <div className="j-trip-stats">
      {[
        ["Monto total", formatSoles(trip.total)],
        ["Tu parte", formatSoles(trip.mine)],
        ["Ruta", `${trip.km} km`],
      ].map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
