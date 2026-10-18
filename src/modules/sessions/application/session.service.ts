import type { SessionRepository } from "@/modules/sessions/infrastructure/session.repository";
import type { ListSessionsQuery } from "@/modules/sessions/schemas/session.schema";
import { NotFoundError } from "@/lib/errors";

export function createSessionService(repo: SessionRepository) {
  return {
    list: (query: ListSessionsQuery) => repo.list(query),
    async getById(id: string) {
      const session = await repo.findById(id);
      if (!session) throw new NotFoundError("Session");
      return session;
    },
  };
}
export type SessionService = ReturnType<typeof createSessionService>;
