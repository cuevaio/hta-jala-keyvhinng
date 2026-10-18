/** Small JPEGs keep uploads and the private room polling response bounded. */
export const MAX_SELFIE_BYTES = 150_000;
export const MAX_SELFIE_DATA_URL_LENGTH =
  23 + 4 * Math.ceil(MAX_SELFIE_BYTES / 3);

export function isSelfieDataUrl(value: string): boolean {
  if (value.length > MAX_SELFIE_DATA_URL_LENGTH) return false;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[1].length % 4 !== 0) return false;
  // JPEG start/end markers; SVG and arbitrary URLs are never accepted.
  const bytes = atob(match[1]);
  return (
    bytes.length > 4 &&
    bytes.length <= MAX_SELFIE_BYTES &&
    bytes.charCodeAt(0) === 255 &&
    bytes.charCodeAt(1) === 216 &&
    bytes.charCodeAt(2) === 255 &&
    bytes.charCodeAt(bytes.length - 2) === 255 &&
    bytes.charCodeAt(bytes.length - 1) === 217
  );
}

/**
 * Where a party member's photo is served. The version changes whenever the stored photo
 * can change, so browsers may cache each URL indefinitely instead of re-downloading it.
 */
export function selfiePath(
  sessionId: string,
  participantId: string,
  version: Date,
): string {
  return `/api/sessions/${sessionId}/participants/${participantId}/selfie?v=${version.getTime()}`;
}
