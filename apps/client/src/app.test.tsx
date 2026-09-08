import { App } from "./app";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

test("renders the greeting in the main heading", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("<main");
  expect(html).toMatch(/<h1[^>]*>Hello, world!<\/h1>/u);
});
