import { expect, test } from "bun:test";
import { createProvider } from "../src/provider";

function fragmentedResponse(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) {
          controller.enqueue(Uint8Array.of(byte));
        }
        controller.close();
      },
    }),
  );
}

function providerFor(text: string): ReturnType<typeof createProvider> {
  return createProvider({
    apiKey: "test-key",
    fetch: async () => await Promise.resolve(fragmentedResponse(text)),
    model: "test-model",
  });
}

const { signal } = new AbortController();
const messages = [{ content: "Hello", role: "user" as const }];

test("decodes fragmented UTF-8, comments and multiline SSE data", async () => {
  const generate = providerFor(
    ': keepalive\r\n\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"Hé🙂"}}]}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  expect(await Array.fromAsync(generate(messages, signal))).toEqual(["Hé🙂"]);
});

test("sends model, roles and server credentials to OpenRouter", async () => {
  const generate = createProvider({
    apiKey: "test-key",
    fetch: async (url, options) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-key");
      expect(options.signal).toBe(signal);
      expect(options.body).toBe(JSON.stringify({ messages, model: "test-model", stream: true }));
      return await Promise.resolve(fragmentedResponse("data: [DONE]\n\n"));
    },
    model: "test-model",
  });
  expect(await Array.fromAsync(generate(messages, signal))).toEqual([]);
});

test("rejects provider HTTP errors, mid-stream errors and truncated responses", async () => {
  const failed = createProvider({
    apiKey: "test-key",
    fetch: async () => await Promise.resolve(new Response(null, { status: 429 })),
    model: "test-model",
  });
  expect(
    await Array.fromAsync(failed(messages, signal)).catch((error: unknown) => error),
  ).toBeInstanceOf(Error);
  const interrupted = providerFor('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
  expect(
    await Array.fromAsync(interrupted(messages, signal)).catch((error: unknown) => error),
  ).toBeInstanceOf(Error);
  const failedStream = providerFor('data: {"error":{"message":"failed"}}\n\ndata: [DONE]\n\n');
  expect(
    await Array.fromAsync(failedStream(messages, signal)).catch((error: unknown) => error),
  ).toBeInstanceOf(Error);
});
