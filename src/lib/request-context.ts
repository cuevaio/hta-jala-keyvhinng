import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  /** Returned to the client as `x-request-id`, so a report can be matched to logs. */
  requestId: string;
  method: string;
  /** Path with ids masked, so logs group by route and carry no identifiers. */
  route: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

const ID_SEGMENT =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** `/api/sessions/<uuid>/join` → `/api/sessions/:id/join`. Never includes the query. */
export function routeOf(url: string) {
  return new URL(url).pathname.replace(ID_SEGMENT, "/:id");
}

export function runWithRequest<T>(context: RequestContext, task: () => T): T {
  return storage.run(context, task);
}

/** The request being handled, or undefined outside a request (scripts, tests). */
export function currentRequest(): RequestContext | undefined {
  return storage.getStore();
}
