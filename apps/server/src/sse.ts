interface EventBuffer {
  buffer: string;
  data: string[];
}

function splitLines(state: { buffer: string }, text: string): string[] {
  const lines = (state.buffer + text).split("\n");
  state.buffer = lines.pop() ?? "";
  return lines;
}

function readLine(state: EventBuffer, line: string): string | null {
  const text = line.replace(/\r$/u, "");
  if (text.startsWith("data:")) {
    state.data.push(text.slice("data:".length).replace(/^ /u, ""));
  }
  if (text !== "" || state.data.length === 0) {
    return null;
  }
  const event = state.data.join("\n");
  state.data = [];
  return event;
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const state: EventBuffer = { buffer: "", data: [] };
  for await (const chunk of body) {
    for (const line of splitLines(state, decoder.decode(chunk, { stream: true }))) {
      const event = readLine(state, line);
      if (event !== null) {
        yield event;
      }
    }
  }
}

export { readEvents };
