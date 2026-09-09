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

function readDelta(value: unknown): string {
  if (typeof value !== "object" || value === null || "error" in value) {
    throw new Error("Provider returned an error");
  }
  if (!("choices" in value) || !Array.isArray(value.choices)) {
    throw new Error("Invalid provider response");
  }
  const choice: unknown = value.choices[0];
  if (typeof choice !== "object" || choice === null) {
    return "";
  }
  if ("finish_reason" in choice && choice.finish_reason === "error") {
    throw new Error("Provider generation failed");
  }
  if (!("delta" in choice) || typeof choice.delta !== "object" || choice.delta === null) {
    return "";
  }
  if (!("content" in choice.delta) || choice.delta.content === null) {
    return "";
  }
  if (typeof choice.delta.content !== "string") {
    throw new Error("Invalid provider content");
  }
  return choice.delta.content;
}

function createProvider(config: ProviderConfig): ReplyProvider {
  return async function* generate(messages, signal): AsyncGenerator<string> {
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
    for await (const event of readEvents(response.body)) {
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
