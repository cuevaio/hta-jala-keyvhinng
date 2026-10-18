import { z } from "zod";

/**
 * What the browser reports about how someone moves through the app. Paths carry no
 * query string and labels come from visible button text or `data-track`, never from
 * inputs, so no address, coordinate, photo or chat text is ever sent.
 */
export const CLIENT_EVENT_TYPES = [
  "view",
  "click",
  "submit",
  "step",
  "error",
] as const;

export const clientEvent = z.object({
  type: z.enum(CLIENT_EVENT_TYPES),
  /** Pathname only. */
  path: z.string().max(200).startsWith("/"),
  /** What was pressed or submitted, e.g. `button:Buscar mi grupo`. */
  target: z.string().max(100).optional(),
  /** Error message, for `error`. */
  detail: z.string().max(300).optional(),
  /** Milliseconds since the tab opened, to order events within a batch. */
  at: z.number().int().nonnegative(),
});

export const clientEventBatch = z.object({
  /** Random per browser tab, to follow one person's steps across requests. */
  tab: z.string().min(8).max(40),
  events: z.array(clientEvent).min(1).max(25),
});
export type ClientEvent = z.infer<typeof clientEvent>;
