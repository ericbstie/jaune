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
    fetch: async () => fragmentedResponse(text),
    model: "test-model",
  });
}

const signal = new AbortController().signal;
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
      expect(JSON.parse(String(options.body))).toEqual({
        messages,
        model: "test-model",
        stream: true,
      });
      return fragmentedResponse("data: [DONE]\n\n");
    },
    model: "test-model",
  });
  expect(await Array.fromAsync(generate(messages, signal))).toEqual([]);
});

test("rejects provider HTTP errors, mid-stream errors and truncated responses", async () => {
  const failed = createProvider({
    apiKey: "test-key",
    fetch: async () => new Response(null, { status: 429 }),
    model: "test-model",
  });
  await expect(Array.fromAsync(failed(messages, signal))).rejects.toThrow(
    "Provider request failed",
  );
  const interrupted = providerFor('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
  await expect(Array.fromAsync(interrupted(messages, signal))).rejects.toThrow("before completion");
  const error = providerFor('data: {"error":{"message":"failed"}}\n\ndata: [DONE]\n\n');
  await expect(Array.fromAsync(error(messages, signal))).rejects.toThrow(
    "Provider returned an error",
  );
});
