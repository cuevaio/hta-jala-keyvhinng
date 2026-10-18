/** Transport-agnostic errors thrown by application services. */
export class NotFoundError extends Error {
  constructor(readonly resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}
