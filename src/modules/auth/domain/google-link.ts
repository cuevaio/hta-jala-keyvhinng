/** Enough of an account to decide whether a Google login creates, links, or enters. */
export interface LinkedAccount {
  id: string;
  displayName: string;
  email: string;
  googleSub: string | null;
}

export type GoogleLinkDecision =
  | { type: "sign-in"; userId: string; displayName: string }
  | { type: "link"; userId: string }
  | { type: "create" }
  | { type: "reject" };

/**
 * `sub` is the stable Google account id. An existing password account with the same
 * verified email is linked. A different Google account already on that email is refused.
 * A returning `sub` signs into that user even if Google's email has since changed.
 */
export function decideGoogleLink(
  profile: { sub: string; email: string },
  bySub: LinkedAccount | null,
  byEmail: LinkedAccount | null,
): GoogleLinkDecision {
  if (bySub) {
    return {
      type: "sign-in",
      userId: bySub.id,
      displayName: bySub.displayName,
    };
  }
  if (!byEmail) return { type: "create" };
  if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
    return { type: "reject" };
  }
  if (!byEmail.googleSub) return { type: "link", userId: byEmail.id };
  return {
    type: "sign-in",
    userId: byEmail.id,
    displayName: byEmail.displayName,
  };
}

const NAME_MAX = 60;

/** A display name from Google's profile, or the mailbox local part, within the account limit. */
export function googleDisplayName(
  name: string | undefined,
  email: string,
): string {
  const cleaned = (name ?? "").replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned.slice(0, NAME_MAX);
  const local = (email.split("@")[0] ?? "")
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return local.slice(0, NAME_MAX) || "Pasajero";
}
