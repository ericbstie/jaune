import { expect, test } from "bun:test";

const mobile = { height: 844, width: 390 };
const timeout = 15_000;

function serveAsset(request: Readonly<Request>): Response {
  const filename = new URL(request.url).pathname.slice(1);
  if (!/^[\w.-]+\.(?:js|css)$/u.test(filename)) {
    return new Response(null, { status: 404 });
  }
  return new Response(Bun.file(`dist/${filename}`));
}

async function checkView(view: Bun.WebView): Promise<void> {
  await view.scrollTo("h1", { timeout: 5000 });
  const heading = await view.evaluate(
    "document.querySelector('h1')?.textContent",
  );
  const display = await view.evaluate(
    "getComputedStyle(document.querySelector('main')).display",
  );
  expect(heading).toBe("Hello, world!");
  expect(display).toBe("grid");
}

async function checkLayouts(url: string): Promise<void> {
  using view = new Bun.WebView({ height: 600, width: 800 });
  await view.navigate(url);
  await checkView(view);
  await Bun.write(".generated/desktop.png", await view.screenshot());
  await view.resize(mobile.width, mobile.height);
  await checkView(view);
  const fits = await view.evaluate(
    "document.documentElement.scrollWidth <= innerWidth",
  );
  expect(fits).toBe(true);
  await Bun.write(".generated/mobile.png", await view.screenshot());
}

test(
  "shows the styled greeting on desktop and mobile",
  async () => {
    const server = Bun.serve({
      fetch: serveAsset,
      hostname: "127.0.0.1",
      port: 0,
      routes: { "/": new Response(Bun.file("dist/index.html")) },
    });
    try {
      await checkLayouts(server.url.href);
    } finally {
      await server.stop(true);
    }
  },
  timeout,
);
