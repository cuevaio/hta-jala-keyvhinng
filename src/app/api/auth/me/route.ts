import { handle, ok } from "@/lib/http";
import { readIdentity } from "@/modules/participants/infrastructure/browser-identity";

export const GET = handle(async () => {
  const identity = await readIdentity();
  const response = ok(identity);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
