"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react";
import {
  sessionApi,
  SessionRequestError,
} from "@/components/sessions/session-api";
import {
  activityMessages,
  type ActivityFeed,
} from "@/modules/notifications/domain/activity";

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Lima",
});

/** Activity needs no browser permission. Web Push opt-in stays in the waiting room. */
export function NotificationBell() {
  const panel = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    let stopped = false;
    let running = false;
    let again = false;
    let controller: AbortController | null = null;
    async function load() {
      if (stopped) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      controller = new AbortController();
      try {
        const result = await sessionApi<ActivityFeed>(
          "/api/notifications",
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        );
        if (stopped) return;
        setFeed(result);
        setSignedOut(false);
        setError("");
      } catch (e) {
        if (stopped) return;
        if (e instanceof SessionRequestError && e.status === 401) {
          panel.current?.close();
          setSignedOut(true);
          setFeed(null);
        } else {
          setError("No pudimos actualizar tus avisos. Intenta de nuevo.");
        }
      } finally {
        running = false;
        if (again && !stopped) {
          again = false;
          void load();
        }
      }
    }
    const reload = () => void load();
    const poll = () => {
      if (!document.hidden) reload();
    };
    refresh.current = reload;
    reload();
    const timer = window.setInterval(poll, 15_000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", poll);
    // Push already tells open room tabs to refresh; activity follows the same signal.
    navigator.serviceWorker?.addEventListener("message", reload);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", poll);
      navigator.serviceWorker?.removeEventListener("message", reload);
    };
  }, []);

  async function markRead(ids?: string[]) {
    if (saving) return;
    setSaving(true);
    try {
      await sessionApi("/api/notifications", ids ? { ids } : { all: true });
      refresh.current();
    } catch {
      setError("No pudimos marcar los avisos como leídos. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  // Public pages also use this header. Never show an account's feed while signed out.
  if (signedOut || (!feed && !error)) return null;
  const unread = feed?.unreadCount ?? 0;
  return (
    <div className="notification-control">
      <button
        ref={trigger}
        type="button"
        className="notification-trigger"
        aria-label={
          unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"
        }
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => {
          panel.current?.showModal();
          refresh.current();
        }}
      >
        <Bell size={21} aria-hidden="true" />
        {unread > 0 && <span className="notification-dot" aria-hidden="true" />}
      </button>
      <dialog
        ref={panel}
        id={panelId}
        className="notification-panel"
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) panel.current?.close();
        }}
      >
        <div className="notification-content">
          <div className="notification-heading">
            <div>
              <h2 id={titleId}>Notificaciones</h2>
              <p>Novedades de tus viajes</p>
            </div>
            <button
              type="button"
              className="notification-trigger"
              aria-label="Cerrar notificaciones"
              onClick={() => panel.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {error && (
            <div className="notification-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => refresh.current()}>
                Reintentar
              </button>
            </div>
          )}
          {feed && feed.items.length === 0 && (
            <div className="notification-empty">
              <Bell size={30} aria-hidden="true" />
              <p>Aquí verás las novedades de tu viaje.</p>
              <small>
                Te avisaremos cuando se forme tu grupo o cambie su estado.
              </small>
            </div>
          )}
          {feed && feed.items.length > 0 && (
            <>
              <div className="notification-tools">
                <span>{unread ? `${unread} sin leer` : "Estás al día"}</span>
                {unread > 0 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void markRead()}
                  >
                    <CheckCheck size={16} aria-hidden="true" />
                    {saving ? "Guardando…" : "Marcar todas como leídas"}
                  </button>
                )}
              </div>
              <ul className="notification-list">
                {feed.items.map((item) => (
                  <li
                    key={item.id}
                    className={item.readAt ? "" : "notification-unread"}
                  >
                    <Link
                      href={`/sessions/${item.sessionId}`}
                      onClick={() => {
                        if (!item.readAt) void markRead([item.id]);
                        panel.current?.close();
                      }}
                    >
                      <span className="notification-item-icon">
                        <Bell size={18} aria-hidden="true" />
                      </span>
                      <span className="notification-copy">
                        <strong>{activityMessages[item.kind].title}</strong>
                        <span>{activityMessages[item.kind].body}</span>
                        <time dateTime={item.createdAt}>
                          {dateFormat.format(new Date(item.createdAt))}
                        </time>
                        {!item.readAt && (
                          <span className="sr-only">Sin leer</span>
                        )}
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="notification-footnote">
                Tus 30 avisos más recientes. Los mensajes están en el chat del
                grupo.
              </p>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
