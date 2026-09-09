import { parseContent } from "../src/api";
import { expect, test } from "bun:test";

const oversizedLength = 32_001;

test("accepts trimmed messages and rejects malformed or oversized input", () => {
  expect(parseContent({ content: " hello " })).toBe("hello");
  for (const body of [
    null,
    {},
    { content: 1 },
    { content: "   " },
    { content: "a".repeat(oversizedLength) },
  ]) {
    expect(parseContent(body)).toBeNull();
  }
});
