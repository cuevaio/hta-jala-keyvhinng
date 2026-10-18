import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  ROUTING_BASE_URL: z.string().url().default("https://router.project-osrm.org"),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default("Jala <jala@jala.oak4.xyz>"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Web Push (VAPID). Without both keys, notifications are only logged.
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:jala@jala.oak4.xyz"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validates process.env lazily so `next build` doesn't need a database URL. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid environment variables: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
