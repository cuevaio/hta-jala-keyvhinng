"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Circle,
  Camera,
  Check,
  Clock3,
  Home,
  LocateFixed,
  LogOut,
  Mail,
  MapPin,
  QrCode,
  Search,
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
import {
  DISTRICTS,
  type SimGroup,
} from "@/modules/simulation/domain/simulation";
import {
  readDemoTrips,
  writeDemoTrips,
  SAMPLE_TRIPS,
  type DemoTrip,
} from "./demo-history";
import { JourneyMap } from "./journey-map";

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
}: {
  onClose: () => void;
  origin: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function share() {
    const text = `Viaje de ejemplo Jala: ${origin} → Barranco. Grupo Rosa 04. No incluye seguimiento en tiempo real.`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Mi viaje de ejemplo", text });
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
            <small>
              Envía a tu familia el resumen de este viaje de ejemplo.
            </small>
          </span>
        </button>
        <button
          className="j-safety-item"
          onClick={() =>
            setNotice(
              "Este es un recorrido de ejemplo. Para un viaje real, contacta al organizador de tu sala desde el flujo de viajes en vivo.",
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
  const [origin, setOrigin] = useState("Av. José Larco 345, Miraflores");
  const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("");
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
  const photoInput = useRef<HTMLInputElement>(null);
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
  const groupRoute: SimGroup[] = [
    {
      id: 1,
      stops: [
        { id: 1, x: 1.2, y: -3.7, district: district || "Barranco" },
        { id: 2, x: 2.4, y: -4.4, district: district || "Barranco" },
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
      setError(
        "No pudimos cargar el historial local. Se muestran los viajes de ejemplo.",
      );
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
      origin,
      destination: district,
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
      setError(
        "El viaje se guardó solo en esta sesión: el navegador no permite guardar el historial local.",
      );
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
      setError(
        "No pudimos guardar tu respuesta en este navegador. Inténtalo otra vez.",
      );
    }
  }
  const displayName = name.trim() || "Flor";
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filteredDistricts = DISTRICTS.filter((d) =>
    normalize(d).includes(normalize(query)),
  );
  const title = TITLES[screen];
  const tabs = ["home", "trips", "account"].includes(screen);
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
  const resetRide = () => {
    setVerified(false);
    setSelfie(null);
    setMessages(INITIAL_MESSAGES);
    setSaved(null);
    setFare("28.50");
    setLeaving(false);
    nav("destination");
  };

  return (
    <div className="passenger-app">
      <div className="j-demo-bar">
        <span>Recorrido de ejemplo</span>
        <Link href="/ride">
          Viajes en vivo <ArrowRight size={12} />
        </Link>
      </div>
      <div
        className={`j-phone ${screen === "chat" ? "j-phone-chat" : ""} ${tabs ? "j-has-tabs" : ""}`}
      >
        {screen === "home" || screen === "login" ? (
          <header
            className={`j-brand-header ${screen === "login" ? "j-login-header" : ""}`}
          >
            <Link href="/" aria-label="Jala, inicio">
              <Image
                src="/jala-logo.png"
                alt="jala"
                width={88}
                height={41}
                priority
              />
            </Link>
            {screen === "home" && (
              <div>
                <button
                  className="j-avatar"
                  onClick={() => nav("account")}
                  aria-label="Abrir mi cuenta"
                >
                  {displayName[0]?.toUpperCase()}
                </button>
                <button
                  className="j-circle"
                  onClick={() => {
                    setSelfie(null);
                    setMessages([]);
                    setName("");
                    nav("login");
                  }}
                  aria-label="Salir del recorrido"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
          </header>
        ) : (
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
                  ? `Saliendo desde ${origin.split(",")[0]}`
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
                  Probar el recorrido <ArrowRight size={20} />
                </Primary>
              </form>
              <p className="j-login-note">
                Explora el viaje con datos de ejemplo. El acceso por SMS todavía
                no está disponible.
              </p>
              <div className="j-divider">o</div>
              <Link className="j-secondary" href="/sign-in?next=%2Fride">
                <Mail size={21} /> Continuar con correo
              </Link>
              <p className="j-login-admin">
                <Link href="/admin">
                  Ver simulador de agrupamiento <ArrowRight size={14} />
                </Link>
              </p>
            </>
          )}

          {screen === "home" && (
            <>
              <p className="j-eyebrow">
                <i /> COMPARTE EL REGRESO
              </p>
              <h1 className="j-home-title" ref={heading} tabIndex={-1}>
                Buenos días, {displayName.split(" ")[0]}.<br />
                <em>¿Volvemos juntos?</em>
              </h1>
              <p className="j-intro">
                Comparte un taxi con personas que salen cerca de ti y van hacia
                tu zona. Cada quien llega a su puerta y paga su tramo.
              </p>
              <div className="j-search-card">
                <div>
                  <div className="j-origin-label">
                    <strong>
                      <Circle size={10} aria-hidden="true" /> Punto de partida
                    </strong>
                    <button
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setError(
                            "Tu navegador no permite obtener la ubicación.",
                          );
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) =>
                            setOrigin(
                              `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
                            ),
                          () =>
                            setError(
                              "No pudimos acceder a tu ubicación. Escribe tu punto de partida.",
                            ),
                          { timeout: 10000 },
                        );
                      }}
                    >
                      <LocateFixed size={16} /> Usar mi ubicación
                    </button>
                  </div>
                  <label className="sr-only" htmlFor="j-origin">
                    Punto de partida
                  </label>
                  <input
                    id="j-origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div>
                  <button className="j-destination-preview" onClick={resetRide}>
                    <span>
                      <MapPin size={17} /> ¿A dónde vas?
                    </span>
                    <strong>{district || "Distrito, calle o lugar"}</strong>
                  </button>
                  <Primary
                    disabled={origin.trim().length < 3}
                    onClick={resetRide}
                  >
                    Buscar compañeros de viaje <ArrowRight size={21} />
                  </Primary>
                </div>
              </div>
              <p className="j-privacy">
                <Shield size={18} /> Tu destino exacto solo se comparte con tu
                grupo de viaje.
              </p>
              <div className="j-promo">
                <p>Tu ruta, nuestro viaje.</p>
                <h2>4 viajes sin comisión</h2>
                <span>Tus primeros 5 son gratis</span>
              </div>
              <div className="j-shortcuts">
                {["Casa", "Trabajo", "Otros"].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      resetRide();
                      setQuery("");
                    }}
                  >
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
                  <small>Explora salas reales o crea la tuya.</small>
                </span>
                <ArrowRight size={20} />
              </Link>
            </>
          )}

          {screen === "destination" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                nav("selfie");
              }}
            >
              <label className="j-search-input">
                <Search size={23} />
                <input
                  aria-label="Distrito de destino"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Distrito de destino"
                />
              </label>
              <div
                className="j-districts"
                role="region"
                aria-label="Distritos de destino"
              >
                {filteredDistricts.map((d) => (
                  <div key={d} className={district === d ? "selected" : ""}>
                    <span>
                      <strong>{d}</strong>
                      <small>Lima</small>
                    </span>
                    <button
                      type="button"
                      aria-pressed={district === d}
                      onClick={() => {
                        setDistrict(d);
                        setQuery("");
                      }}
                    >
                      {district === d ? "Elegido" : "Elegir"}
                    </button>
                  </div>
                ))}
                {filteredDistricts.length === 0 && query && (
                  <p>Prueba con otro distrito de Lima.</p>
                )}
              </div>
              <label className="j-field">
                Dirección exacta · solo la ve tu grupo
                <input
                  placeholder="Calle y número"
                  value={address}
                  required
                  maxLength={200}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
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
              <Primary disabled={!district || address.trim().length < 3}>
                Buscar grupo
              </Primary>
            </form>
          )}

          {screen === "selfie" && (
            <>
              <div className="j-match-banner">
                <span className="j-pink-dot" /> Encontramos tu grupo: 2 personas
                · Grupo Rosa 04
              </div>
              <div className="j-camera-preview">
                {selfie ? (
                  <Image
                    src={selfie}
                    alt="Tu selfie seleccionada"
                    fill
                    unoptimized
                    className="j-photo"
                  />
                ) : (
                  <>
                    <div className="j-face-guide" />
                    <p>Centra tu rostro dentro del óvalo</p>
                  </>
                )}
              </div>
              <p className="j-selfie-copy">
                Antes de confirmar el grupo, toma una selfie. Solo la verán tus
                compañeros en el chat temporal para reconocerte, y se borra
                cuando el chat se cierra.
              </p>
              <input
                ref={photoInput}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                aria-label="Seleccionar selfie"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (
                    file.size > 5 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    setError("Elige una imagen JPG, PNG o WebP de hasta 5 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setSelfie(String(reader.result));
                    setError("");
                  };
                  reader.onerror = () =>
                    setError("No pudimos leer la foto. Inténtalo otra vez.");
                  reader.readAsDataURL(file);
                }}
              />
              <Primary
                onClick={() =>
                  selfie ? nav("group") : photoInput.current?.click()
                }
              >
                {selfie ? (
                  <>
                    <Check size={21} /> Confirmar y ver mi grupo
                  </>
                ) : (
                  <>
                    <Camera size={21} /> Tomar selfie
                  </>
                )}
              </Primary>
              <button
                className="j-secondary"
                onClick={() => {
                  setSelfie("/demo/example-selfie.jpg");
                  nav("group");
                }}
              >
                Usar foto de ejemplo
              </button>
              <p className="j-fine">
                Grupo de ejemplo ·{" "}
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
                    <strong>Salida · {origin.split(",")[0]}</strong>
                    <small>{meeting} · 5 min a pie</small>
                  </div>
                </li>
                <li>
                  <span className="j-stop j-stop-mine">1</span>
                  <div>
                    <strong>Tú — {district}</strong>
                    <small>~10 min · sin desvío</small>
                  </div>
                  <b>{Math.round(SHARES[0] / 100)}%</b>
                </li>
                <li>
                  <span className="j-stop">2</span>
                  <div>
                    <strong>
                      Gabriela I. {delegate ? "" : "· delegado "}— {district}
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
                  <strong>¿Salir del grupo de ejemplo?</strong>
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
                  <legend>Elige un punto de ejemplo</legend>
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
                <JourneyMap groups={groupRoute} label={origin} compact />
              </div>
              <p className="j-fine">
                Ruta ilustrativa de ejemplo. El viaje en vivo calcula las rutas
                por calles.
              </p>
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
                      {i === 0 ? "Tú" : person} — {district}
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
                  title="Código QR de ejemplo para Grupo Rosa 04"
                />
              </div>
              <h2>JL-04-56A</h2>
              <p>
                El delegado lo escanea para confirmar que perteneces a este
                grupo.
              </p>
              <p className="j-fine">
                Código de demostración, sin validez para viajes reales.
              </p>
              <button className="j-secondary" onClick={() => nav("verify")}>
                Probar verificación
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
                  <small>{district}</small>
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
                    Verificación de ejemplo: usa el código del grupo. La cámara
                    QR para viajes reales requiere una integración adicional.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (
                        scanCode.trim() !== "JL-04-56A" &&
                        scanCode.trim() !== DEMO_CODE
                      ) {
                        setError(
                          "Este código no pertenece al grupo de ejemplo.",
                        );
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
                    <Primary>Verificar código de ejemplo</Primary>
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
                        {Math.round(SHARES[i] / 100)}% del costo · {district}
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
                <small>Comisión Jala para ti · ejemplo</small>
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
                  Guardamos tu viaje en el historial de este navegador.
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
                ruta y monto. Este historial de ejemplo se guarda en tu
                navegador.
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
              <p className="j-history-note">
                Tus respuestas se guardan en este navegador para el recorrido de
                ejemplo.
              </p>
            </>
          )}

          {screen === "account" && (
            <>
              <div className="j-account">
                <Avatar name={displayName} />
                <h2>{displayName}</h2>
                <p>Estás explorando el recorrido de ejemplo.</p>
              </div>
              <Link href="/sign-in?next=%2Fride" className="j-primary">
                <Mail size={20} /> Entrar a mi cuenta real
              </Link>
              <Link href="/ride" className="j-secondary">
                Buscar un viaje en vivo <ArrowRight size={19} />
              </Link>
              <Link href="/admin" className="j-secondary">
                Simulador de agrupamiento
              </Link>
              <button
                className="j-secondary"
                onClick={() => {
                  setSelfie(null);
                  setMessages([]);
                  nav("login");
                }}
              >
                Salir del recorrido
              </button>
            </>
          )}
        </div>
        {tabs && (
          <nav className="j-bottom-nav" aria-label="Navegación principal">
            {(
              [
                { id: "home", label: "Inicio", Icon: Home },
                { id: "trips", label: "Mis viajes", Icon: Clock3 },
                { id: "account", label: "Cuenta", Icon: UserRound },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-current={screen === id ? "page" : undefined}
                onClick={() => (id === "trips" ? loadTrips() : nav(id))}
              >
                <Icon size={24} />
                {id === "trips" &&
                  trips.some((t) =>
                    t.companions.some((p) => !(p in t.ratings)),
                  ) && <span className="j-nav-badge">1</span>}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
      {safety && (
        <SafetySheet origin={origin} onClose={() => setSafety(false)} />
      )}
      <footer className="j-shell-footer">
        <Link href="/admin">Panel de validación</Link>
        <span>Hecho en Lima · Jala</span>
      </footer>
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
