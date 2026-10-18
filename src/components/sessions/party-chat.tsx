"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, SendHorizontal } from "lucide-react";
import {
  PARTY_MESSAGE_MAX_LENGTH,
  QUICK_MESSAGES,
} from "@/modules/parties/domain/party-message";
import { sessionApi, SessionRequestError } from "./session-api";

/** JSON shape of a party message; dates arrive as ISO strings. */
interface ChatMessage {
  seq: number;
  participantId: string;
  displayName: string;
  body: string;
  createdAt: string;
}

const limaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Appends messages not seen yet, keeping `seq` order. */
function merge(current: ChatMessage[], incoming: ChatMessage[]) {
  const seen = new Set(current.map((m) => m.seq));
  const fresh = incoming.filter((m) => !seen.has(m.seq));
  if (!fresh.length) return current;
  return [...current, ...fresh].sort((a, b) => a.seq - b.seq);
}

/** Group chat for one ride party. Render with `key={party.id}` so a new party starts empty. */
export function PartyChat({
  sessionId,
  meId,
  revision,
}: {
  sessionId: string;
  meId: string;
  revision: number;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canPost, setCanPost] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Consecutive failed reads; drives the retry backoff and the reconnecting notice.
  const [failures, setFailures] = useState(0);
  const lastSeq = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);
  const path = `/api/sessions/${sessionId}/party/messages`;

  useEffect(() => {
    lastSeq.current = messages.at(-1)?.seq ?? 0;
    if (stickToBottom.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  // New messages bump the room revision, which the room poll already watches, so the
  // chat fetches only when something changed instead of running its own timer.
  useEffect(() => {
    const controller = new AbortController();
    // Unmounting and a slow read both abort; only the first should stay quiet.
    let unmounted = false;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let retry: ReturnType<typeof setTimeout> | undefined;
    sessionApi<{ canPost: boolean; messages: ChatMessage[] }>(
      `${path}?after=${lastSeq.current}`,
      undefined,
      controller.signal,
    )
      .then((result) => {
        setMessages((current) => merge(current, result.messages));
        setCanPost(result.canPost);
        setLoaded(true);
        setFailures(0);
      })
      .catch((e) => {
        if (unmounted) return;
        // A 404 means the party is gone; the room poll reports that. Timeouts and
        // other failures retry with backoff, since an unchanged room would not
        // trigger another fetch.
        if (e instanceof SessionRequestError && e.status === 404) return;
        setFailures((n) => n + 1);
        retry = setTimeout(
          () => setAttempt((n) => n + 1),
          Math.min(30_000, 5000 * 2 ** failures),
        );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      unmounted = true;
      clearTimeout(timeout);
      clearTimeout(retry);
      controller.abort();
    };
    // `failures` only sets the next delay; it must not start a fetch by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, revision, attempt]);

  async function send(body: string) {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await sessionApi<ChatMessage>(path, { body: text });
      stickToBottom.current = true;
      setMessages((current) => merge(current, [message]));
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo enviar el mensaje.",
      );
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <section className="party-chat" aria-labelledby="party-chat-title">
      <h3 id="party-chat-title">
        <MessageCircle size={18} aria-hidden="true" />
        Chat del grupo
      </h3>
      {failures > 0 && (
        <p className="chat-reconnecting" role="status">
          Reconectando el chat… Los mensajes nuevos aparecerán solos.
        </p>
      )}
      <ol
        ref={list}
        className="chat-log"
        role="log"
        aria-live="polite"
        aria-label="Mensajes del grupo"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.length === 0 && (
          <li className="chat-empty">
            {loaded
              ? "Aún no hay mensajes. Coordinen aquí dónde se encuentran."
              : failures > 0
                ? "No pudimos cargar los mensajes. Reintentando…"
                : "Cargando mensajes…"}
          </li>
        )}
        {messages.map((m) => {
          const mine = m.participantId === meId;
          return (
            <li
              key={m.seq}
              className={mine ? "chat-message chat-mine" : "chat-message"}
            >
              <span className="chat-meta">
                {mine ? "Tú" : m.displayName} · {limaTime(m.createdAt)}
              </span>
              <p>{m.body}</p>
            </li>
          );
        })}
      </ol>

      {canPost ? (
        <>
          <div className="chat-quick" aria-label="Respuestas rápidas">
            {QUICK_MESSAGES.map((text) => (
              <button
                key={text}
                type="button"
                className="chat-chip"
                disabled={sending}
                onClick={() => void send(text)}
              >
                {text}
              </button>
            ))}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <label htmlFor="chat-input" className="sr-only">
              Escribe un mensaje al grupo
            </label>
            <input
              id="chat-input"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={PARTY_MESSAGE_MAX_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un mensaje…"
            />
            <button
              type="submit"
              className="action action-primary"
              disabled={sending || draft.trim() === ""}
              aria-label="Enviar mensaje"
            >
              <SendHorizontal size={18} aria-hidden="true" />
            </button>
          </form>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="wait-note">El viaje terminó; el chat es solo lectura.</p>
      )}
      <p className="fine">
        Solo las personas de tu grupo de viaje ven estos mensajes. No compartas
        datos de pago.
      </p>
    </section>
  );
}
