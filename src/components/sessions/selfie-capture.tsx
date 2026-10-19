"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { prepareSelfie } from "./selfie-photo";

type Stage = "idle" | "starting" | "live" | "checking";

const ACTION_CLASSES = {
  primary: "action action-primary",
  secondary: "action action-secondary",
};

/**
 * Takes the selfie inside the face oval. Phones open their own front camera
 * (`capture="user"`), which is sharper and needs no camera permission in the page;
 * desktops show a live webcam preview with a shutter. A camera is required — there
 * is no gallery picker — and the photo is resized and checked for a face by the server.
 */
export function SelfieCapture({
  value,
  onChange,
  hint,
  confirm,
  compact = false,
  disabled = false,
  buttons = ACTION_CLASSES,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown between the camera and the actions. */
  hint?: ReactNode;
  /** The primary action once a photo is accepted, when the flow has one. */
  confirm?: ReactNode;
  /** A smaller frame for forms with other fields around it. */
  compact?: boolean;
  disabled?: boolean;
  /** Button classes, so each flow keeps its own button style. */
  buttons?: { primary: string; secondary: string };
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const attempt = useRef(0);
  const busy = disabled || stage === "starting" || stage === "checking";

  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => stopCamera, []);

  async function check(photo: Blob) {
    const current = ++attempt.current;
    stopCamera();
    setStage("checking");
    setError("");
    onChange(null);
    try {
      const dataUrl = await prepareSelfie(photo);
      if (current === attempt.current) onChange(dataUrl);
    } catch (e) {
      if (current === attempt.current)
        setError(
          e instanceof Error
            ? e.message
            : "No pudimos leer tu foto. Intenta de nuevo.",
        );
    } finally {
      if (current === attempt.current) setStage("idle");
    }
  }

  async function takeSelfie() {
    setError("");
    if (window.matchMedia("(pointer: coarse)").matches) {
      cameraInput.current?.click();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Necesitas una cámara para tomarte tu selfie.");
      return;
    }
    setStage("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 } },
        audio: false,
      });
      setStage("live");
    } catch (e) {
      setStage("idle");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permite el acceso a la cámara en tu navegador para tomarte tu selfie."
          : "No encontramos una cámara disponible. Necesitas una cámara para tomarte tu selfie.",
      );
    }
  }

  // The <video> mounts with the live stage, so attach the stream once it exists.
  useEffect(() => {
    if (stage === "live" && video.current && stream.current)
      video.current.srcObject = stream.current;
  }, [stage]);

  function shutter() {
    const frame = video.current;
    if (!frame?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = frame.videoWidth;
    canvas.height = frame.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    // Keep the photo as the person saw it in the mirrored preview.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(frame, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) void check(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  const pickFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (file) void check(file);
  };

  return (
    <div
      className={`selfie-capture${compact ? " selfie-capture-compact" : ""}`}
    >
      <div className="selfie-stage" data-stage={stage}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Tu selfie" className="selfie-stage-media" />
        ) : stage === "live" ? (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className="selfie-stage-media selfie-stage-video"
            aria-label="Vista previa de la cámara"
          />
        ) : (
          <button
            type="button"
            className="selfie-stage-trigger"
            onClick={() => void takeSelfie()}
            disabled={busy}
          >
            <Camera size={compact ? 22 : 28} aria-hidden="true" />
            <span>
              {stage === "starting"
                ? "Abriendo la cámara…"
                : stage === "checking"
                  ? "Comprobando que se vea tu rostro…"
                  : "Toca para tomar tu selfie"}
            </span>
          </button>
        )}
        {!value && <div className="selfie-face-guide" aria-hidden="true" />}
        {stage === "live" && (
          <p className="selfie-stage-caption">
            Centra tu rostro dentro del óvalo
          </p>
        )}
      </div>
      {hint}
      {error && (
        <p className="form-error selfie-error" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {stage === "checking"
          ? "Comprobando que se vea tu rostro"
          : value
            ? "Rostro detectado. Tu selfie está lista."
            : ""}
      </p>
      <input
        ref={cameraInput}
        type="file"
        className="sr-only"
        accept="image/*"
        capture="user"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pickFile(e.currentTarget)}
      />
      <div className="selfie-actions">
        {value ? (
          <>
            {confirm}
            <button
              type="button"
              className={buttons.secondary}
              disabled={disabled}
              onClick={() => {
                onChange(null);
                void takeSelfie();
              }}
            >
              <RotateCcw size={18} aria-hidden="true" /> Repetir foto
            </button>
          </>
        ) : stage === "live" ? (
          <>
            <button type="button" className={buttons.primary} onClick={shutter}>
              <Camera size={21} aria-hidden="true" /> Tomar foto
            </button>
            <button
              type="button"
              className={buttons.secondary}
              onClick={() => {
                stopCamera();
                setStage("idle");
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            className={buttons.primary}
            onClick={() => void takeSelfie()}
            disabled={busy}
          >
            <Camera size={21} aria-hidden="true" /> Tomar selfie
          </button>
        )}
      </div>
    </div>
  );
}
