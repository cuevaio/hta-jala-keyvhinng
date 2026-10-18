"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, ImageUp, RotateCcw } from "lucide-react";
import { prepareSelfie } from "@/components/sessions/selfie-photo";

type Stage = "idle" | "starting" | "live" | "checking";

/**
 * Takes the selfie inside the face oval. Phones open their own front camera
 * (`capture="user"`), which is sharper and needs no camera permission in the page;
 * desktops show a live webcam preview with a shutter. Either way the photo goes
 * through the same resize and face check as the live ride flow, and "Subir una foto"
 * is always there for anyone without a usable camera.
 */
export function SelfieCapture({
  value,
  onChange,
  hint,
  confirm,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown between the camera and the actions. */
  hint: ReactNode;
  /** The primary action once a photo is accepted. */
  confirm: ReactNode;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const attempt = useRef(0);

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
            : "No pudimos leer tu foto. Intenta con otra.",
        );
    } finally {
      if (current === attempt.current) setStage("idle");
    }
  }

  async function takeSelfie() {
    setError("");
    const phone = window.matchMedia("(pointer: coarse)").matches;
    if (phone || !navigator.mediaDevices?.getUserMedia) {
      (phone ? cameraInput : fileInput).current?.click();
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
          ? "Permite el acceso a la cámara en tu navegador o sube una foto."
          : "No encontramos una cámara disponible. Sube una foto.",
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
    <div className="j-selfie-capture">
      <div className="j-camera-preview" data-stage={stage}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Tu selfie" className="j-photo" />
        ) : stage === "live" ? (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className="j-camera-video"
            aria-label="Vista previa de la cámara"
          />
        ) : (
          <button
            type="button"
            className="j-camera-trigger"
            onClick={() => void takeSelfie()}
            disabled={stage !== "idle"}
          >
            <Camera size={28} aria-hidden="true" />
            <span>
              {stage === "starting"
                ? "Abriendo la cámara…"
                : stage === "checking"
                  ? "Comprobando que se vea tu rostro…"
                  : "Toca para tomar tu selfie"}
            </span>
          </button>
        )}
        {!value && <div className="j-face-guide" aria-hidden="true" />}
        {stage === "live" && <p>Centra tu rostro dentro del óvalo</p>}
      </div>
      {hint}
      {error && (
        <p className="j-error" role="alert">
          {error}
        </p>
      )}
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
      <input
        ref={fileInput}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pickFile(e.currentTarget)}
      />
      <div className="j-selfie-actions">
        {value ? (
          <>
            {confirm}
            <button
              type="button"
              className="j-secondary"
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
            <button type="button" className="j-primary" onClick={shutter}>
              <Camera size={21} aria-hidden="true" /> Tomar foto
            </button>
            <button
              type="button"
              className="j-secondary"
              onClick={() => {
                stopCamera();
                setStage("idle");
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="j-primary"
              onClick={() => void takeSelfie()}
              disabled={stage !== "idle"}
            >
              <Camera size={21} aria-hidden="true" /> Tomar selfie
            </button>
            <button
              type="button"
              className="j-link-button"
              onClick={() => fileInput.current?.click()}
              disabled={stage !== "idle"}
            >
              <ImageUp size={16} aria-hidden="true" /> o sube una foto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
