import { MapPin, Ticket, Users } from "lucide-react";

/** Brand illustration only; it deliberately shows no invented route estimates. */
export function DeparturePass() {
  return (
    <div className="departure-pass">
      <div className="pass-top">
        <span>
          <Ticket size={18} aria-hidden="true" /> Tu próxima salida
        </span>
        <span className="pass-stamp">Con Jala</span>
      </div>
      <div className="pass-main">
        <p className="pass-title">
          Misma salida.
          <br />
          Cada quien
          <br />a su puerta.
        </p>
        <svg
          className="route-art"
          viewBox="0 0 360 220"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M42 38v56c0 28 23 50 50 50h88c28 0 50-22 50-50v-4c0-23 19-42 42-42h44"
            stroke="white"
            strokeOpacity=".3"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M42 38v56c0 28 23 50 50 50h88c28 0 50-22 50-50v-4c0-23 19-42 42-42h44"
            stroke="#F6D65B"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M132 144v14c0 23 19 42 42 42h136"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="42" cy="38" r="12" fill="#F6D65B" />
          <circle
            cx="132"
            cy="144"
            r="9"
            fill="#2457E6"
            stroke="white"
            strokeWidth="4"
          />
          <circle
            cx="230"
            cy="94"
            r="9"
            fill="#2457E6"
            stroke="white"
            strokeWidth="4"
          />
          <circle cx="316" cy="48" r="9" fill="white" />
          <circle cx="310" cy="200" r="9" fill="white" />
        </svg>
        <div className="pass-route-label">
          <span>
            <Users size={16} aria-hidden="true" /> Un punto de partida
          </span>
          <span>
            <MapPin size={16} aria-hidden="true" /> Tu destino exacto
          </span>
        </div>
      </div>
      <div className="pass-bottom">
        <span>El taxi se reserva en una app externa.</span>
        <span className="pass-punches" aria-hidden="true">
          •••••
        </span>
      </div>
    </div>
  );
}
