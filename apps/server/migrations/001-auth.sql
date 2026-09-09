CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL, image text,
  "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS "session" (
  id text PRIMARY KEY, token text NOT NULL UNIQUE,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL, "ipAddress" text, "userAgent" text
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session" ("userId");
CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" text, "refreshToken" text, "idToken" text,
  "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
  scope text, password text, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL,
  UNIQUE ("providerId", "accountId")
);
CREATE INDEX IF NOT EXISTS account_user ON account ("userId");
CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
  "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_identifier ON verification (identifier);
CREATE TABLE IF NOT EXISTS "deviceCode" (
  id text PRIMARY KEY, "deviceCode" text NOT NULL UNIQUE, "userCode" text NOT NULL UNIQUE,
  "userId" text, "expiresAt" timestamptz NOT NULL, status text NOT NULL,
  "lastPolledAt" timestamptz, "pollingInterval" integer, "clientId" text, scope text
);
