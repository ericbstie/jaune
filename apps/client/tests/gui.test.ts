import { expect, test } from "bun:test";
import { createTestServer } from "../../server/tests/support";

const mobile = { height: 844, width: 390 };
const timeout = 30_000;
const serverPort = 3000;

function serveAsset(request: Request): Response {
  const filename = new URL(request.url).pathname.slice(1);
  if (!/^[\w.-]+\.(?:js|css)$/u.test(filename)) {
    return new Response(null, { status: 404 });
  }
  return new Response(
    Bun.file(new URL(`../dist/${filename}`, import.meta.url)),
  );
}

async function waitForMessages(
  view: Bun.WebView,
  expected: string[],
): Promise<void> {
  await view.evaluate(`new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Messages did not load')); }, 5000);
    const check = () => {
      const actual = Array.from(document.querySelectorAll('[aria-label="Messages"] li'), item => item.textContent);
      if (JSON.stringify(actual) === ${JSON.stringify(JSON.stringify(expected))}) { clearTimeout(timeout); observer.disconnect(); resolve(true); }
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    check();
  })`);
  const contents = await view.evaluate(
    "Array.from(document.querySelectorAll('[aria-label=\"Messages\"] li'), item => item.textContent)",
  );
  expect(contents).toEqual(expected);
}

async function send(view: Bun.WebView, content: string): Promise<void> {
  await view.click("input[aria-label='Message']:not(:disabled)");
  await view.type(content);
  await view.click("button[type='submit']:not(:disabled)");
}

async function verifyChat(
  view: Bun.WebView,
  url: string,
  token: string,
): Promise<void> {
  await view.navigate(url);
  await view.scrollTo("button", { timeout: 5000 });
  expect(await view.evaluate<string>("document.body.textContent")).toContain(
    "Sign in with Google",
  );
  await view.evaluate(
    `sessionStorage.setItem('jaune.session', ${JSON.stringify(token)})`,
  );
  await view.reload();
  await view.click("aside > button:first-child:not(:disabled)");
  await send(view, "First message");
  await waitForMessages(view, ["First message", "Test reply"]);
  await send(view, "Second message");
  await waitForMessages(view, [
    "First message",
    "Test reply",
    "Second message",
    "Test reply",
  ]);
  await view.reload();
  await view.click("nav button:not(:disabled)");
  await waitForMessages(view, [
    "First message",
    "Test reply",
    "Second message",
    "Test reply",
  ]);
  await Bun.write(".generated/chat-desktop.png", await view.screenshot());
  await view.resize(mobile.width, mobile.height);
  expect(
    await view.evaluate<boolean>(
      "document.documentElement.scrollWidth <= innerWidth",
    ),
  ).toBe(true);
  await Bun.write(".generated/chat-mobile.png", await view.screenshot());
}

test(
  "client sends messages and retrieves server history after reload",
  async () => {
    const fixture = await createTestServer(serverPort);
    const index = Bun.file(new URL("../dist/index.html", import.meta.url));
    const frontend = Bun.serve({
      fetch: serveAsset,
      hostname: "127.0.0.1",
      port: 0,
      routes: { "/": new Response(index) },
    });
    fixture.trustedOrigins.push(frontend.url.origin);
    try {
      using view = new Bun.WebView({
        backend: "chrome",
        height: 600,
        width: 800,
      });
      await verifyChat(view, frontend.url.href, fixture.session.token);
      const rows = await fixture.database<
        { content: string }[]
      >`SELECT content FROM message ORDER BY id`;
      expect(rows.map((row) => row.content)).toEqual([
        "First message",
        "Test reply",
        "Second message",
        "Test reply",
      ]);
    } finally {
      await frontend.stop(true);
      await fixture.close();
    }
  },
  timeout,
);
