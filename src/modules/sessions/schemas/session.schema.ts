import { z } from "zod";
import { DEPARTURE_CHOICES } from "@/modules/sessions/domain/affinity";
import { SESSION_STATUSES } from "@/modules/sessions/domain/session";

export const sessionIdParams = z.object({ id: z.uuid() });
export const roomRevisionQuery = z.object({
  rev: z.coerce.number().int().nonnegative().optional(),
});
export const participantSelfieParams = z.object({
  id: z.uuid(),
  participantId: z.uuid(),
});

export const listSessionsQuery = z.object({
  placeId: z.uuid().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuery>;

import { isSelfieDataUrl, MAX_SELFIE_DATA_URL_LENGTH } from "../domain/selfie";

const latitude = z.number().finite().min(-90).max(90);
const longitude = z.number().finite().min(-180).max(180);
const departure = z
  .number()
  .refine((n): n is (typeof DEPARTURE_CHOICES)[number] =>
    (DEPARTURE_CHOICES as readonly number[]).includes(n),
  );

export const joinSessionInput = z.object({
  selfieDataUrl: z
    .string()
    .max(MAX_SELFIE_DATA_URL_LENGTH)
    .refine(isSelfieDataUrl, "Sube una selfie en formato JPEG."),
  /** Rooms show the account's name; older clients still send one. */
  displayName: z.string().trim().min(1).max(60).optional(),
  originLabel: z.string().trim().min(3).max(200),
  originLatitude: latitude,
  originLongitude: longitude,
  destinationLabel: z.string().trim().min(3).max(200),
  latitude,
  longitude,
  delegatePreference: z.enum(["delegate", "passenger"]),
});
export type JoinSessionInput = z.infer<typeof joinSessionInput>;

/** Creating a group also joins it, so the creator is its first member. */
export const createGroupInput = joinSessionInput.extend({
  departInMinutes: departure,
  /** The destination's district. Rooms are public, so this is all they show of it. */
  destinationArea: z.string().trim().min(2).max(60).optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupInput>;

const coordinate = (bound: number) =>
  z.coerce.number().finite().min(-bound).max(bound);
export const searchGroupsQuery = z.object({
  olat: coordinate(90),
  olng: coordinate(180),
  dlat: coordinate(90),
  dlng: coordinate(180),
  depart: z.coerce.number().pipe(departure).default(0),
});
export type SearchGroupsQuery = z.infer<typeof searchGroupsQuery>;
