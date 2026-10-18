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
