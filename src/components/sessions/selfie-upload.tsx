"use client";

import { useRef, useState } from "react";
import { MAX_SELFIE_DATA_URL_LENGTH } from "@/modules/sessions/domain/selfie";

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
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Elige una foto JPG, PNG o WebP.");
      if (file.size > 10_000_000)
        throw new Error("La foto debe pesar menos de 10 MB.");
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      try {
        const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("No pudimos preparar tu foto. Intenta con otra.");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const photo = canvas.toDataURL("image/jpeg", 0.8);
        if (photo.length > MAX_SELFIE_DATA_URL_LENGTH)
          throw new Error("Elige una foto más pequeña.");
        if (current === selection.current) onChange(photo);
      } finally {
        bitmap.close();
      }
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
        onChange={(event) => void select(event.target.files?.[0])}
      />
      {processing && (
        <p role="status" className="fine">
          Preparando tu selfie…
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
          <figcaption className="fine">Tu selfie está lista.</figcaption>
        </figure>
      )}
    </div>
  );
}
