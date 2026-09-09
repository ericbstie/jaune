import { createClient } from "./api";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { App } from "./app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const client = createClient(
  process.env["BUN_PUBLIC_SERVER_URL"] ?? "http://localhost:3000",
  sessionStorage,
  fetch,
);
async function openSignIn(url: string): Promise<void> {
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Missing root element");
}
createRoot(root).render(
  <StrictMode>
    <App client={client} openURL={openSignIn} />
  </StrictMode>,
);
