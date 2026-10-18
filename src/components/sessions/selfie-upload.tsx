"use client";

import { useRef, useState } from "react";
import { prepareSelfie } from "./selfie-photo";

export function SelfieUpload({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const selection = useRef(0);

  async function select(file: File | undefined) {
    const current = ++selection.current;
    onChange("");
    setError("");
    if (!file) {
      setProcessing(false);
      return;
    }
    setProcessing(true);
    try {
      const photo = await prepareSelfie(file);
      if (current === selection.current) onChange(photo);
    } catch (e) {
      if (current === selection.current)
        setError(
          e instanceof Error
            ? e.message
            : "No pudimos leer tu foto. Intenta con otra.",
        );
    } finally {
      if (current === selection.current) setProcessing(false);
    }
  }

  return (
    <div className="form-section">
      <label htmlFor="selfie">Tu selfie (obligatoria)</label>
      <p id="selfie-hint" className="fine">
        Sube una foto donde se vea tu rostro. Solo la verán tus compañeros
        cuando se forme tu grupo de viaje.
      </p>
      <input
        id="selfie"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        aria-describedby={error ? "selfie-hint selfie-error" : "selfie-hint"}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          void select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {processing && (
        <p role="status" className="fine">
          Comprobando que se vea tu rostro…
        </p>
      )}
      {error && (
        <p id="selfie-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      {value && (
        <figure className="selfie-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Vista previa de tu selfie"
            width={96}
            height={96}
          />
          <figcaption className="fine">
            Rostro detectado. Tu selfie está lista.
          </figcaption>
        </figure>
      )}
    </div>
  );
}
