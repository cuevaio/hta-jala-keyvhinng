"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { ClientEvent } from "@/lib/client-events";

const FLUSH_MS = 3_000;
const MAX_BATCH = 25;
const CLICKABLE =
  "button, a, summary, label, [role='button'], input[type='radio'], input[type='checkbox']";

const queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let tab = "";
const started = typeof performance === "undefined" ? 0 : performance.now();

function tabId() {
  if (tab) return tab;
  try {
    tab = sessionStorage.getItem("jala:tab") ?? "";
    if (!tab) {
      tab = crypto.randomUUID();
      sessionStorage.setItem("jala:tab", tab);
    }
  } catch {
    tab ||= crypto.randomUUID();
  }
  return tab;
}

/** Sends what is queued. A beacon survives the page being closed or navigated away. */
function flush() {
  clearTimeout(timer);
  timer = undefined;
  while (queue.length) {
    const body = JSON.stringify({
      tab: tabId(),
      events: queue.splice(0, MAX_BATCH),
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob))
      void fetch("/api/events", {
        method: "POST",
        body,
        keepalive: true,
      }).catch(() => {});
  }
}

function record(event: Omit<ClientEvent, "path" | "at">) {
  queue.push({
    ...event,
    path: location.pathname,
    at: Math.round(performance.now() - started),
  });
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}

/** A step in a flow that is not a press, e.g. a room turning into a group. */
export function logStep(target: string, detail?: string) {
  record({ type: "step", target: clean(target), ...(detail && { detail }) });
}

const clean = (text: string | null | undefined) =>
  text?.replace(/\s+/g, " ").trim().slice(0, 80) || "";

/**
 * Names what was pressed by what its user saw: `data-track` when set, else its label.
 * Anything inside `[data-log-private]` (address suggestions, names) is named by tag only.
 */
function describe(element: Element) {
  const tag = element.tagName.toLowerCase();
  const tracked = element.closest("[data-track]")?.getAttribute("data-track");
  if (tracked) return clean(tracked);
  if (element.closest("[data-log-private]")) return `${tag}:private`;
  const label =
    element.getAttribute("aria-label") ||
    (element instanceof HTMLInputElement
      ? element.closest("label")?.textContent
      : element.textContent);
  return `${tag}:${clean(label) || element.id || "unlabeled"}`;
}

/**
 * Reports page views, presses, form submits and uncaught errors to the server log, so a
 * person's steps can be followed after the fact (`ui.*` lines, grouped by `tab`).
 */
export function InteractionLog() {
  const pathname = usePathname();

  useEffect(() => {
    record({ type: "view" });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest?.(CLICKABLE);
      if (!element) return;
      // A label click also clicks its input; log the input only.
      if (element.tagName === "LABEL" && element.querySelector("input")) return;
      const disabled =
        element.matches(":disabled") ||
        element.getAttribute("aria-disabled") === "true";
      record({
        type: "click",
        target: `${describe(element)}${disabled ? " (disabled)" : ""}`,
      });
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      record({
        type: "submit",
        target: clean(
          form.getAttribute("data-track") ||
            form.id ||
            form.getAttribute("aria-label") ||
            form.className.split(" ")[0] ||
            "form",
        ),
      });
    };
    const onError = (event: ErrorEvent) =>
      record({ type: "error", detail: clean(event.message) || "error" });
    const onRejection = (event: PromiseRejectionEvent) =>
      record({
        type: "error",
        detail:
          clean(
            event.reason instanceof Error
              ? `${event.reason.name}: ${event.reason.message}`
              : String(event.reason),
          ) || "unhandled rejection",
      });
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return null;
}
