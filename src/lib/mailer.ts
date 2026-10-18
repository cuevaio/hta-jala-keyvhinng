import { logger } from "@/lib/logger";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Port for transactional email. Swap the adapter in services.ts for a real provider. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/**
 * Development adapter: writes the message to the server log. It never delivers mail,
 * so in production it only warns; a provider adapter is required before real users
 * can receive reset links.
 */
export function createLogMailer(): Mailer {
  return {
    async send(email) {
      if (process.env.NODE_ENV === "production") {
        logger.warn("No mail provider configured; email was not delivered", {
          subject: email.subject,
        });
        return;
      }
      logger.info("Email (dev log mailer)", { ...email });
    },
  };
}

/** Resend adapter: delivers through the Resend HTTP API. */
export function createResendMailer(
  apiKey: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    async send(email) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend rejected the email (${response.status})`);
      }
    },
  };
}
