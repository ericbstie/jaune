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

async function readReply(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error("Reply stream ended before completion");
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const event: unknown = JSON.parse(line);
        const message = readEvent(event, onDelta);
        if (message !== undefined) {
          return message;
        }
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export { readReply };
