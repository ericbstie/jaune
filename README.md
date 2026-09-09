# Jaune

A self-hosted graphical interface for coding agents. Connect your existing Codex, Claude, and OpenRouter accounts in one place.
## Chat

Create PostgreSQL databases named `jaune` and `jaune_test`. Copy
`mise.local.example.toml` to `mise.local.toml` and fill in the credentials.
Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.

Create a Google OAuth web client with this redirect URI:
`http://localhost:3000/api/auth/callback/google`.

Run `mise run install`, then `mise run server:dev` and `mise run dev` in separate
terminals. The server creates its tables on startup. Sign in opens the system
browser. Confirm the matching code there, then return to the app.

`mise run checks` runs formatting, lint, type checks, server tests, Rust checks,
and a WebView test that sends messages and reloads their history. Tests use an
isolated schema in `TEST_DATABASE_URL`, then remove it. The WebView test uses a
seeded Better Auth session, without contacting Google.

The server stores conversations and messages. It does not generate AI replies.
Sessions stay in the app window's session storage; conversation history stays in
PostgreSQL when the window closes.

For a remote server, use HTTPS and update `BETTER_AUTH_URL`, the Google redirect
URI, and `BUN_PUBLIC_SERVER_URL` in `mise.local.toml`. Also replace the server
origin in the Tauri CSP and opener capability before building the client.
