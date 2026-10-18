import { EmailTakenError, InvalidCredentialsError } from "@/lib/errors";
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

export function createAuthService(repository: AuthRepository) {
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
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
