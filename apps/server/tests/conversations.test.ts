import { expect, test } from "bun:test";
import { createTestServer } from "./support";
import { migrate } from "../src/migrate";

const timeout = 30_000;
const missing = 404;
const unauthorized = 401;
const created = 201;
const invalid = 400;
const forbidden = 403;
const deleted = 204;

function api(url: URL, token: string): (path?: string, options?: RequestInit) => Promise<Response> {
  return async (path = "", options = {}): Promise<Response> =>
    await fetch(new URL(`/api/conversations${path}`, url), {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
}
function post(content: string): RequestInit {
  return { body: JSON.stringify({ content }), method: "POST" };
}
async function getConversationId(response: Response): Promise<string> {
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("Missing conversation ID");
  }
  return value.id;
}
async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected a rejection");
}

test(
  "persists ordered history, isolates owners and cascades deletion",
  async () => {
    const fixture = await createTestServer();
    try {
      const { server, session, otherSession } = fixture;
      const owner = api(server.url, session.token);
      const stranger = api(server.url, otherSession.token);
      const unauthenticated = api(server.url, "invalid");
      expect((await unauthenticated()).status).toBe(unauthorized);
      const response = await owner("", { body: "{}", method: "POST" });
      expect(response.status).toBe(created);
      const id = await getConversationId(response);
      const path = `/${id}/messages`;
      expect((await owner(path, post("first"))).status).toBe(created);
      expect((await owner(path, post("second"))).status).toBe(created);
      await migrate(fixture.database);
      expect(await (await owner(path)).json()).toMatchObject([
        { content: "first" },
        { content: "second" },
      ]);
      expect(await (await owner()).json()).toMatchObject([{ id, title: "first" }]);
      expect(await (await stranger()).json()).toEqual([]);
      expect((await stranger(path)).status).toBe(missing);
      expect((await stranger(path, post("stolen"))).status).toBe(missing);
      expect((await stranger(`/${id}`, { method: "DELETE" })).status).toBe(missing);
      expect((await owner(path, post(" "))).status).toBe(invalid);
      expect((await owner(`/${id}`, { method: "DELETE" })).status).toBe(deleted);
      expect((await owner(path)).status).toBe(missing);
      const remainingMessages = await fixture.database<{ id: string }[]>`SELECT id FROM message`;
      expect(remainingMessages).toHaveLength(0);
      const cors = await fetch(new URL("/api/conversations", server.url), {
        headers: { Origin: "https://evil.example" },
        method: "POST",
      });
      expect(cors.status).toBe(forbidden);
    } finally {
      await fixture.close();
    }
  },
  timeout,
);

test(
  "uses Google OAuth, requires approval and issues a revocable device session",
  async () => {
    const fixture = await createTestServer();
    try {
      const { auth, session, server } = fixture;
      const google = await auth.api.signInSocial({
        body: {
          callbackURL: `${server.url.origin}/device`,
          disableRedirect: true,
          provider: "google",
        },
      });
      expect(new URL(google.url ?? "").hostname).toBe("accounts.google.com");
      const code = await auth.api.deviceCode({ body: { client_id: "jaune" } });
      const tokenBody = {
        client_id: "jaune",
        device_code: code.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code" as const,
      };
      expect(await rejected(auth.api.deviceToken({ body: tokenBody }))).toMatchObject({
        body: { error: "authorization_pending" },
      });
      const headers = new Headers({ Authorization: `Bearer ${session.token}` });
      await auth.api.deviceVerify({ headers, query: { user_code: code.user_code } });
      await auth.api.deviceApprove({ body: { userCode: code.user_code }, headers });
      await fixture.database`UPDATE "deviceCode" SET "lastPolledAt" = NULL`;
      const token = await auth.api.deviceToken({ body: tokenBody });
      const signedIn = api(server.url, token.access_token);
      expect((await signedIn()).ok).toBe(true);
      expect(await rejected(auth.api.deviceToken({ body: tokenBody }))).toBeDefined();
      await auth.api.signOut({
        headers: new Headers({ Authorization: `Bearer ${token.access_token}` }),
      });
      expect((await signedIn()).status).toBe(unauthorized);
    } finally {
      await fixture.close();
    }
  },
  timeout,
);
