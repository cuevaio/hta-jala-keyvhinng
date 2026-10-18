export async function sessionApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new SessionRequestError(
      response.status,
      result.error?.message ?? "No se pudo conectar. Intenta de nuevo.",
    );
  return result.data as T;
}
export class SessionRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
