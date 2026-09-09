function readEvent(value: unknown, onDelta: (delta: string) => void): unknown {
  if (typeof value !== "object" || value === null || "error" in value) {
    throw new Error("Reply failed");
  }
  if ("message" in value) {
    return value.message;
  }
  if (!("delta" in value) || typeof value.delta !== "string") {
    throw new Error("Invalid reply event");
  }
  onDelta(value.delta);
  return undefined;
}

function splitLines(state: { buffer: string }, text: string): string[] {
  const lines = (state.buffer + text).split("\n");
  state.buffer = lines.pop() ?? "";
  return lines;
}

async function readReply(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<unknown> {
  const decoder = new TextDecoder();
  const state = { buffer: "" };
  for await (const chunk of body) {
    for (const line of splitLines(
      state,
      decoder.decode(chunk, { stream: true }),
    )) {
      const event: unknown = JSON.parse(line);
      const message = readEvent(event, onDelta);
      if (message !== undefined) {
        return message;
      }
    }
  }
  throw new Error("Reply stream ended before completion");
}

export { readReply };
