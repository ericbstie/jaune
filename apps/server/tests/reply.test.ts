import { expect, test } from "bun:test";
import { createTestServer } from "./support";
import type { TestServer } from "./support";
import type { PromptMessage } from "../src/provider";

const timeout = 30_000;
const notFound = 404;
const conflict = 409;

async function request(fixture: TestServer, path: string, body?: unknown): Promise<Response> {
  return await fetch(new URL(`/api/conversations${path}`, fixture.server.url), {
    body: body === undefined ? null : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${fixture.session.token}`,
      "Content-Type": "application/json",
    },
    method: body === undefined ? "GET" : "POST",
  });
}

async function seed(fixture: TestServer): Promise<{ id: string; messageId: string }> {
  await request(fixture, "", {});
  const [conversation] = await fixture.database<{ id: string }[]>`SELECT id FROM conversation`;
  if (!conversation) {
    throw new Error("Missing conversation");
  }
  await request(fixture, `/${conversation.id}/messages`, { content: "Hello" });
  const [message] = await fixture.database<{ id: string }[]>`SELECT id::text FROM message`;
  if (!message) {
    throw new Error("Missing message");
  }
  return { id: conversation.id, messageId: message.id };
}

test(
  "streams before completion, persists roles and rejects duplicate and foreign replies",
  async () => {
    const release = Promise.withResolvers<boolean>();
    async function* generate(
      messages: readonly PromptMessage[],
      signal: AbortSignal,
    ): AsyncGenerator<string> {
      expect(messages).toEqual([{ content: "Hello", role: "user" }]);
      signal.throwIfAborted();
      yield "First ";
      await release.promise;
      yield "reply";
    }
    const fixture = await createTestServer(0, generate);
    try {
      const { id, messageId } = await seed(fixture);
      const path = `/${id}/reply`;
      const foreign = await request({ ...fixture, session: fixture.otherSession }, path, {
        messageId,
      });
      expect(foreign.status).toBe(notFound);
      const response = await request(fixture, path, { messageId });
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Missing stream");
      }
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain('"delta":"First "');
      release.resolve(true);
      const remainder = await new Response(
        new ReadableStream({
          async pull(controller): Promise<void> {
            const next = await reader.read();
            if (next.done) {
              controller.close();
            } else {
              controller.enqueue(next.value);
            }
          },
        }),
      ).text();
      expect(remainder).toContain('"message":');
      const history = await request(fixture, `/${id}/messages`);
      expect(await history.json()).toMatchObject([
        { content: "Hello", role: "user" },
        { content: "First reply", role: "assistant" },
      ]);
      expect((await request(fixture, path, { messageId })).status).toBe(conflict);
    } finally {
      release.resolve(true);
      await fixture.close();
    }
  },
  timeout,
);

async function* failedReply(): AsyncGenerator<string> {
  yield await Promise.resolve("partial");
  throw new Error("Provider failed");
}

test(
  "keeps user messages but never saves partial replies",
  async () => {
    const fixture = await createTestServer(0, failedReply);
    try {
      const { id, messageId } = await seed(fixture);
      const response = await request(fixture, `/${id}/reply`, { messageId });
      expect(await response.text()).toContain('"error":');
      const history = await request(fixture, `/${id}/messages`);
      expect(await history.json()).toMatchObject([{ content: "Hello", role: "user" }]);
      const rows = await fixture.database<
        { id: string }[]
      >`SELECT id FROM message WHERE role = 'assistant'`;
      expect(rows).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  },
  timeout,
);
