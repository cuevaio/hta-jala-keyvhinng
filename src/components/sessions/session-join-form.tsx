import type { FormEventHandler } from "react";
import { MapPin, UserRound, CarFront, ShieldCheck } from "lucide-react";

export function SessionJoinForm({
  onJoin,
  busy,
}: {
  onJoin: FormEventHandler<HTMLFormElement>;
  busy: boolean;
}) {
  return (
    <form onSubmit={onJoin} className="join-form">
      <header className="form-heading">
        <h2>¿A dónde vas?</h2>
        <p>Cada persona conserva su destino. Empieza por el tuyo.</p>
      </header>
      <div className="form-section">
        <label htmlFor="display-name">¿Cómo te llamas?</label>
        <div className="input-with-icon">
          <UserRound size={19} aria-hidden="true" />
          <input
            id="display-name"
            className="form-input"
            name="displayName"
            required
            maxLength={60}
            autoComplete="nickname"
            placeholder="Tu nombre para la sala"
          />
        </div>
        <p className="input-help">Las otras personas verán este nombre.</p>
      </div>
      <div className="form-section">
        <label htmlFor="destination">Tu destino exacto</label>
        <div className="input-with-icon">
          <MapPin size={19} aria-hidden="true" />
          <input
            id="destination"
            className="form-input"
            name="destinationLabel"
            required
            minLength={3}
            maxLength={200}
            placeholder="Dirección o referencia de llegada"
          />
        </div>
      </div>
      <fieldset className="coordinates-section">
        <legend>Ubicación del destino</legend>
        <p className="input-help">
          Copia las coordenadas desde tu aplicación de mapas. La búsqueda de
          direcciones aún no está disponible.
        </p>
        <div className="coordinate-fields">
          <label>
            Latitud
            <input
              className="form-input"
              type="number"
              step="any"
              min={-90}
              max={90}
              name="latitude"
              required
              placeholder="-12.1219"
            />
          </label>
          <label>
            Longitud
            <input
              className="form-input"
              type="number"
              step="any"
              min={-180}
              max={180}
              name="longitude"
              required
              placeholder="-77.0297"
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="delegate-section">
        <legend>¿Puedes reservar el taxi?</legend>
        <p className="input-help">
          Una persona del futuro grupo lo reservará en una app externa.
        </p>
        <div className="delegate-choices">
          <label className="delegate-choice">
            <input
              type="radio"
              name="delegatePreference"
              value="passenger"
              defaultChecked
            />
            <span>
              <UserRound size={20} aria-hidden="true" />
              <strong>Voy de pasajero</strong>
              <span>Prefiero que otra persona reserve.</span>
            </span>
          </label>
          <label className="delegate-choice">
            <input type="radio" name="delegatePreference" value="delegate" />
            <span>
              <CarFront size={20} aria-hidden="true" />
              <strong>Puedo reservar</strong>
              <span>Yo pido el taxi y pago mi parte.</span>
            </span>
          </label>
        </div>
      </fieldset>
      <p className="privacy-note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>
          Tu dirección solo se muestra en tu vista de la sala. Esta demo no
          verifica identidades ni realiza cobros.
        </span>
      </p>
      <button disabled={busy} className="action action-primary form-submit">
        {busy ? "Guardando tu destino…" : "Unirme a la sala"}
      </button>
    </form>
  );
}
