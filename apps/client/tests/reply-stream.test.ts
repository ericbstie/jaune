import { expect, test } from "bun:test";
import { readReply } from "../src/reply-stream";

function stream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const byte of new TextEncoder().encode(text)) {
        controller.enqueue(Uint8Array.of(byte));
      }
      controller.close();
    },
  });
}

test("renders fragmented deltas and returns only the committed message", async () => {
  const deltas: string[] = [];
  const message = { content: "Hé🙂", id: "2", role: "assistant" };
  const result = await readReply(
    stream(`{"delta":"Hé🙂"}\n${JSON.stringify({ message })}\n`),
    (delta) => {
      deltas.push(delta);
    },
  );
  expect(deltas).toEqual(["Hé🙂"]);
  expect(result).toEqual(message);
});

test("rejects failed or interrupted streams", async () => {
  const deltas: string[] = [];
  function receive(delta: string): void {
    deltas.push(delta);
  }
  expect(
    await readReply(stream('{"delta":"partial"}\n'), receive).catch(
      (error: unknown) => error,
    ),
  ).toBeInstanceOf(Error);
  expect(
    await readReply(stream('{"error":"Failed"}\n'), receive).catch(
      (error: unknown) => error,
    ),
  ).toBeInstanceOf(Error);
});
