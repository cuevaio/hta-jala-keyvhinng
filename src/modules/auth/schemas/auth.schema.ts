import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// scrypt has no 72-byte limit like bcrypt, but unbounded input is a DoS vector.
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Escribe un correo válido."));

export const signUpInput = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Escribe tu nombre.")
    .max(60, "Usa 60 caracteres o menos."),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH, "La contraseña es demasiado larga."),
});

export const signInInput = z.object({
  email,
  password: z
    .string()
    .min(1, "Escribe tu contraseña.")
    .max(PASSWORD_MAX_LENGTH),
});

export type SignUpInput = z.infer<typeof signUpInput>;
export type SignInInput = z.infer<typeof signInInput>;

/** Only same-site relative paths may be redirect targets (blocks open redirects). */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/";
  return value;
}
