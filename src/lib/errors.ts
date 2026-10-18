/** Transport-agnostic errors thrown by application services. */
export class NotFoundError extends Error {
  constructor(readonly resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailTakenError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super("Invalid or expired password reset token");
    this.name = "InvalidResetTokenError";
  }
}

/** Sign in with Google could not finish. `reason` is safe to show as a redirect code. */
export class GoogleSignInError extends Error {
  constructor(readonly reason: "unverified" | "conflict" | "failed") {
    super(reason);
    this.name = "GoogleSignInError";
  }
}
