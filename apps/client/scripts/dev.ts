import page from "../src/index.html";

Bun.serve({
  development: { console: true, hmr: true },
  hostname: Bun.env["TAURI_DEV_HOST"] ?? "127.0.0.1",
  port: 1420,
  routes: { "/": page },
});
