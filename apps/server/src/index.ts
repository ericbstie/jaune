import { createProvider } from "./provider";
import { SQL } from "bun";
import { createAuth } from "./auth";
import { handleRequest } from "./server";
import { migrate } from "./migrate";

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const baseURL = required(Bun.env, "BETTER_AUTH_URL");
const database = new SQL(required(Bun.env, "DATABASE_URL"));
const trustedOrigins = [
  new URL(baseURL).origin,
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];
const auth = createAuth(database, {
  baseURL,
  googleClientId: required(Bun.env, "GOOGLE_CLIENT_ID"),
  googleClientSecret: required(Bun.env, "GOOGLE_CLIENT_SECRET"),
  secret: required(Bun.env, "BETTER_AUTH_SECRET"),
  trustedOrigins,
});
const generate = createProvider({
  apiKey: required(Bun.env, "OPENROUTER_API_KEY"),
  fetch,
  model: required(Bun.env, "OPENROUTER_MODEL"),
});
await migrate(database);
Bun.serve({
  fetch: async (request) => await handleRequest(request, { auth, database, generate, trustedOrigins }),
  idleTimeout: 0,
  maxRequestBodySize: 128_000,
  port: Number(Bun.env["PORT"] ?? "3000"),
});
