import { account, deviceCode, session, user, verification } from "./auth-schema";

import { bearer, deviceAuthorization } from "better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/bun-sql";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { SQL } from "bun";

const schema = { account, deviceCode, session, user, verification };

interface AuthConfig {
  baseURL: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
  trustedOrigins: string[];
}

// Preserve Better Auth's inferred plugin API.
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
function createAuth(database: SQL, config: AuthConfig) {
  return betterAuth({
    baseURL: config.baseURL,
    database: drizzleAdapter(drizzle(database, { schema }), {
      provider: "pg",
      schema,
      transaction: true,
    }),
    plugins: [
      bearer(),
      deviceAuthorization({
        expiresIn: "5m",
        validateClient: (clientId) => clientId === "jaune",
        verificationUri: `${config.baseURL}/device`,
      }),
    ],
    secret: config.secret,
    socialProviders: {
      google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret },
    },
    trustedOrigins: config.trustedOrigins,
  });
}

type Auth = ReturnType<typeof createAuth>;
export { createAuth };
export type { Auth, AuthConfig };
