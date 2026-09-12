import { createClient } from "./api";
import { createMockFetch } from "./mock-api";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { App } from "./app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const mockAuthentication =
  process.env["BUN_PUBLIC_BUILD_MODE"] === "test" &&
  process.env["BUN_PUBLIC_MOCK_AUTH"] === "true";
const fetchImpl = mockAuthentication ? createMockFetch() : fetch;

const client = createClient(
  process.env["BUN_PUBLIC_SERVER_URL"] ?? "http://localhost:3000",
  sessionStorage,
  fetchImpl,
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
