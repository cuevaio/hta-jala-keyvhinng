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
