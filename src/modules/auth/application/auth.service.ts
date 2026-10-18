import { createHash, randomBytes } from "node:crypto";
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidResetTokenError,
} from "@/lib/errors";
import type { Mailer } from "@/lib/mailer";
import {
  decoyHash,
  hashPassword,
  verifyPassword,
} from "@/modules/auth/domain/password";
import {
  isUniqueViolation,
  type AuthRepository,
} from "@/modules/auth/infrastructure/auth.repository";
import type {
  SignInInput,
  SignUpInput,
} from "@/modules/auth/schemas/auth.schema";

export interface AuthenticatedUser {
  userId: string;
  displayName: string;
}

const RESET_TTL_MS = 30 * 60 * 1000;
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function createAuthService(
  repository: AuthRepository,
  mailer: Mailer,
  appUrl: string,
) {
  return {
    async signUp(input: SignUpInput): Promise<AuthenticatedUser> {
      const passwordHash = await hashPassword(input.password);
      try {
        const { id } = await repository.create({
          displayName: input.displayName,
          email: input.email,
          passwordHash,
        });
        return { userId: id, displayName: input.displayName };
      } catch (error) {
        // The unique index is the source of truth, so concurrent sign-ups can't both win.
        if (isUniqueViolation(error)) throw new EmailTakenError();
        throw error;
      }
    },

    async signIn(input: SignInInput): Promise<AuthenticatedUser> {
      const account = await repository.findByEmail(input.email);
      // Always run one scrypt verification so unknown emails cost the same time.
      const valid = await verifyPassword(
        input.password,
        account?.passwordHash ?? (await decoyHash()),
      );
      if (!account || !valid) throw new InvalidCredentialsError();
      return { userId: account.id, displayName: account.displayName };
    },

    /**
     * Always resolves, so callers cannot learn which emails have accounts. Only the
     * hash of the emailed token is stored.
     */
    async requestPasswordReset(email: string): Promise<void> {
      const account = await repository.findByEmail(email);
      if (!account) return;
      const token = randomBytes(32).toString("hex");
      await repository.saveResetToken(
        account.id,
        sha256(token),
        new Date(Date.now() + RESET_TTL_MS),
      );
      await mailer.send({
        to: account.email,
        subject: "Restablece tu contraseña de Jala",
        text: `Usa este enlace en los próximos 30 minutos:\n${appUrl}/reset-password?token=${token}\n\nSi no lo pediste, ignora este mensaje.`,
      });
    },

    async resetPassword(token: string, password: string): Promise<void> {
      const userId = await repository.resetPassword(
        sha256(token),
        await hashPassword(password),
      );
      if (!userId) throw new InvalidResetTokenError();
    },

    async changePassword(
      userId: string,
      currentPassword: string,
      newPassword: string,
    ): Promise<void> {
      const account = await repository.findById(userId);
      if (
        !account ||
        !(await verifyPassword(currentPassword, account.passwordHash))
      )
        throw new InvalidCredentialsError();
      await repository.changePassword(userId, await hashPassword(newPassword));
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
