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

## Sign in with Google

Email and password stay available. When `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
are both set, the home screen, `/sign-in`, and `/sign-up` show **Continuar con Google**.
A signed-in account skips the home screen's local name form. **Cerrar sesión** there
ends the browser session.

`GET /api/auth/google` stores a random `state` and PKCE verifier in the HttpOnly cookie
`jala_google_oauth` (10 minutes, SameSite=Lax) and redirects to Google. The callback
`GET /api/auth/google/callback` checks that state, exchanges the code, and accepts the ID
token only after its RS256 signature matches Google's published keys and the audience is
this client. The redirect URI is `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`.

A verified Google email creates an account with no password, or links onto the password
account that already uses that email. The same Google subject (`users.google_sub`) returns
to that account afterwards. An unverified email is refused. If that email is already linked
to a different Google subject, sign-in stops. A Google-only account can add a password later
through the existing reset flow. Password sign-in still fails for an account with no password.

Create the client in [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=hack-the-andes-anti)
for project `hack-the-andes-anti` (Web application). Google shut down the IAP OAuth Admin
API on 19 March 2026, so `gcloud` cannot create this client. Register both the local and
production callback URLs, then put the client id and secret in the environment (Vercel for
production). Scopes are `openid`, `email`, and `profile`. Publish the consent screen so
people outside the test-user list can sign in; those scopes do not ask for extra Google
verification, though Google may still label the app unverified until brand review.
The migration lets `password_hash` be null when `google_sub` is set.

## Not done yet

- **Mail delivery needs configuration.** With `RESEND_API_KEY` (and optionally
  `MAIL_FROM`) set, reset links go out through Resend. Without it the log-only adapter is
  used, and in production it only logs a warning, so reset links reach nobody. The
  sender domain must be verified in Resend, and delivery has not been tested to a real inbox.
- Email verification, account deletion, a signed-in change-password page (API exists),
  and a "sign out everywhere" button.

Apply migrations before deploying (`bun run db:migrate`).
