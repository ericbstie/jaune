async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = line.replace(/\r$/u, "");
        if (text === "") {
          if (data.length > 0) {
            yield data.join("\n");
            data = [];
          }
        } else if (text.startsWith("data:")) {
          data.push(text.slice("data:".length).replace(/^ /u, ""));
        }
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export { readEvents };
