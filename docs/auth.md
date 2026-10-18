# Accounts and sessions

Email + password accounts (scrypt, OWASP parameters). Sessions are random 256-bit
tokens in an HttpOnly, SameSite=Lax cookie; only the SHA-256 hash is stored in
`browser_sessions` (7 days, expired rows deleted on each new login).

## Endpoints

| Route                                      | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `POST /api/auth/sign-up` / `sign-in` / `sign-out` | As before                                     |
| `POST /api/auth/password-reset/request`    | `{ email }`. Always `200`, so accounts cannot be enumerated |
| `POST /api/auth/password-reset/confirm`    | `{ token, password }`. `400 invalid_token` if unknown, expired (30 min) or used |
| `POST /api/auth/change-password`           | `{ currentPassword, newPassword }`, signed in. Revokes every session, then re-issues this browser's |

Pages: `/forgot-password`, `/reset-password?token=…` (sets `Referrer-Policy: no-referrer`).
A reset or password change signs the account out everywhere. Only the newest reset link works.

## Abuse controls

- Rate limits live in Postgres (`rate_limits`, one atomic upsert per hit), so they hold
  across instances and restarts. Sign-in is limited per email+client (8/15 min), per
  client (30) and per email (40), so one attacker cannot lock the owner out.
- At most two scrypt derivations run at once (~128 MiB each); extra work queues.
- Client identity comes from `x-forwarded-for`. Deploy behind a proxy that overwrites it,
  otherwise per-client limits can be dodged (per-email limits still apply).

## Not done yet

- **Mail delivery needs configuration.** With `RESEND_API_KEY` (and optionally
  `MAIL_FROM`) set, reset links go out through Resend. Without it the log-only adapter is
  used, and in production it only logs a warning, so reset links reach nobody. The
  sender domain must be verified in Resend, and delivery has not been tested to a real inbox.
- Email verification, account deletion, a signed-in change-password page (API exists),
  and a "sign out everywhere" button.

Apply migrations before deploying (`bun run db:migrate`).
