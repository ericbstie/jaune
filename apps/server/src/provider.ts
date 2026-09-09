import { readEvents } from "./sse";
import type { Message } from "./conversations";

type PromptMessage = Pick<Message, "content" | "role">;
type ReplyProvider = (
  messages: readonly PromptMessage[],
  signal: AbortSignal,
) => AsyncIterable<string>;

interface ProviderConfig {
  apiKey: string;
  model: string;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
}

function readContent(delta: unknown): string {
  if (typeof delta !== "object" || delta === null || !("content" in delta) || delta.content === null) {
    return "";
  }
  if (typeof delta.content !== "string") {
    throw new TypeError("Invalid provider content");
  }
  return delta.content;
}

function readChoice(choice: unknown): string {
  if (typeof choice !== "object" || choice === null) {
    return "";
  }
  if ("finish_reason" in choice && choice.finish_reason === "error") {
    throw new Error("Provider generation failed");
  }
  return readContent("delta" in choice ? choice.delta : undefined);
}

function readDelta(value: unknown): string {
  if (typeof value !== "object" || value === null || "error" in value) {
    throw new Error("Provider returned an error");
  }
  if (!("choices" in value) || !Array.isArray(value.choices)) {
    throw new Error("Invalid provider response");
  }
  return readChoice(value.choices[0]);
}

async function openStream(
  config: ProviderConfig,
  messages: readonly PromptMessage[],
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
    const response = await config.fetch("https://openrouter.ai/api/v1/chat/completions", {
      body: JSON.stringify({ messages, model: config.model, stream: true }),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      method: "POST",
      signal,
    });
    if (!response.ok || response.body === null) {
      await response.body?.cancel();
      throw new Error(`Provider request failed: ${response.status}`);
    }
    return response.body;
}

function createProvider(config: ProviderConfig): ReplyProvider {
  return async function* generate(messages, signal): AsyncGenerator<string> {
    const body = await openStream(config, messages, signal);
    for await (const event of readEvents(body)) {
      if (event === "[DONE]") {
        return;
      }
      const value: unknown = JSON.parse(event);
      const delta = readDelta(value);
      if (delta.length > 0) {
        yield delta;
      }
    }
    throw new Error("Provider stream ended before completion");
  };
}

export { createProvider };
export type { PromptMessage, ReplyProvider };
