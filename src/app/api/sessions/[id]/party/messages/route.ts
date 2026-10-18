import type { NextRequest } from "next/server";
import { ApiError, assertSameOrigin, handle, ok, readJson } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";
import { PartyError } from "@/modules/parties/domain/party-lifecycle";
import {
  partyMessageBody,
  partyMessagesQuery,
} from "@/modules/parties/schemas/party.schema";
import { requireIdentity } from "@/modules/participants/infrastructure/browser-identity";
import { sessionIdParams } from "@/modules/sessions/schemas/session.schema";

type Context = RouteContext<"/api/sessions/[id]/party/messages">;

async function withPartyErrors(task: () => Promise<unknown>) {
  try {
    const response = ok(await task());
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof PartyError)
      throw new ApiError(error.status, error.code, error.message);
    throw error;
  }
}

export const GET = handle(async (request: NextRequest, ctx: Context) => {
  const { userId } = await requireIdentity();
  const { id } = sessionIdParams.parse(await ctx.params);
  const { after } = partyMessagesQuery.parse({
    after: request.nextUrl.searchParams.get("after") ?? undefined,
  });
  return withPartyErrors(() =>
    getServices().partyMessages.list(id, userId, after),
  );
});

export const POST = handle(async (request: NextRequest, ctx: Context) => {
  assertSameOrigin(request);
  const { userId } = await requireIdentity();
  const { id } = sessionIdParams.parse(await ctx.params);
  const { body } = partyMessageBody.parse(await readJson(request));
  if (!(await consume(`chat:${userId}`, 20, 60_000)))
    throw new ApiError(
      429,
      "rate_limited",
      "Estás enviando muchos mensajes. Espera un momento.",
    );
  return withPartyErrors(() =>
    getServices().partyMessages.post(id, userId, body),
  );
});
