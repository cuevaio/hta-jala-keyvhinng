/** "45.5" or "45,50" → 4550 céntimos; null when empty or not a plain amount. */
export function parseFareMinor(value: string): number | null {
  const match = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
