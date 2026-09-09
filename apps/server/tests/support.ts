import type { ReplyProvider } from "../src/provider";
import { SQL } from "bun";
import type { Server } from "bun";
import { createAuth } from "../src/auth";
import type { Auth } from "../src/auth";
import { handleRequest } from "../src/server";
import { migrate } from "../src/migrate";

type Session = Auth["$Infer"]["Session"]["session"];
interface TestServer {
  server: Server<undefined>;
  database: SQL;
  auth: Auth;
  session: Session;
  otherSession: Session;
  trustedOrigins: string[];
  close: () => Promise<void>;
}

async function seedSession(auth: Auth, email: string): Promise<Session> {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    { email, emailVerified: true, name: "Test user" },
    { method: "oauth", oauth: { providerId: "google" } },
  );
  return await context.internalAdapter.createSession(user.id, false);
}

async function* fakeReply(): AsyncGenerator<string> {
  yield "Test ";
  yield "reply";
}

async function createTestServer(
  port = 0,
  generate: ReplyProvider = fakeReply,
): Promise<TestServer> {
  const url = Bun.env["TEST_DATABASE_URL"];
  if (url === undefined || url.length === 0) {
    throw new Error("TEST_DATABASE_URL must point to a test PostgreSQL database");
  }
  const schema = `test_${crypto.randomUUID().replaceAll("-", "")}`;
  const database = new SQL(url, { max: 1, prepare: false });
  const server = Bun.serve({
    fetch: () => new Response(null, { status: 503 }),
    hostname: "127.0.0.1",
    port,
  });
  const trustedOrigins = [server.url.origin];
  async function close(): Promise<void> {
    await server.stop(true);
    await database.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await database.close();
  }
  try {
    await database.unsafe(`CREATE SCHEMA "${schema}"`);
    await database.unsafe(`SET search_path TO "${schema}"`);
    await migrate(database);
    const auth = createAuth(database, {
      baseURL: server.url.origin,
      googleClientId: "test-google-client",
      googleClientSecret: "test-google-secret",
      secret: "test-only-secret-at-least-thirty-two-characters",
      trustedOrigins,
    });
    server.reload({
      fetch: async (request) =>
        await handleRequest(request, { auth, database, generate, trustedOrigins }),
    });
    const session = await seedSession(auth, `${schema}@example.com`);
    const otherSession = await seedSession(auth, `other-${schema}@example.com`);
    return { auth, close, database, otherSession, server, session, trustedOrigins };
  } catch (error) {
    await close();
    throw error;
  }
}

export { createTestServer };
export type { TestServer };
