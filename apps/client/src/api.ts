import { readReply } from "./reply-stream";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

interface Conversation {
  id: string;
  title: string;
}
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}
const sessionKey = "jaune.session";

function parseConversation(value: unknown): Conversation {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("title" in value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string"
  ) {
    throw new Error("Invalid conversation response");
  }
  return { id: value.id, title: value.title };
}
function parseMessage(value: unknown): Message {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("content" in value) ||
    !("role" in value) ||
    (value.role !== "user" && value.role !== "assistant") ||
    typeof value.id !== "string" ||
    typeof value.content !== "string"
  ) {
    throw new Error("Invalid message response");
  }
  return { content: value.content, id: value.id, role: value.role };
}
function parseList<Item>(
  value: unknown,
  parse: (item: unknown) => Item,
): Item[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Invalid list response");
  }
  return value.map((item: unknown) => parse(item));
}

// Preserve Better Auth's inferred plugin methods in the returned client.
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
function createClient(
  baseURL: string,
  storage: Storage,
  fetchImpl: typeof fetch,
) {
  const auth = createAuthClient({
    baseURL,
    fetchOptions: {
      auth: { token: () => storage.getItem(sessionKey) ?? "", type: "Bearer" },
      credentials: "omit",
      customFetchImpl: fetchImpl,
    },
    plugins: [deviceAuthorizationClient()],
  });
  async function requestResponse(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers({
      Authorization: `Bearer ${storage.getItem(sessionKey) ?? ""}`,
      "Content-Type": "application/json",
    });
    const response = await fetchImpl(`${baseURL}/api/conversations${path}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response;
  }
  async function request(path: string, options: RequestInit = {}): Promise<unknown> {
    const response = await requestResponse(path, options);
    return await response.json();
  }
  async function reply(
    id: string,
    messageId: string,
    onDelta: (delta: string) => void,
    signal: AbortSignal,
  ): Promise<Message> {
    const response = await requestResponse(`/${id}/reply`, {
      body: JSON.stringify({ messageId }),
      method: "POST",
      signal,
    });
    if (response.body === null) {
      throw new Error("Missing reply stream");
    }
    return parseMessage(await readReply(response.body, onDelta));
  }
  async function list(): Promise<Conversation[]> {
    return parseList(await request(""), parseConversation);
  }
  async function create(): Promise<Conversation> {
    return parseConversation(await request("", { body: "{}", method: "POST" }));
  }
  async function messages(id: string): Promise<Message[]> {
    return parseList(await request(`/${id}/messages`), parseMessage);
  }
  async function send(id: string, content: string): Promise<Message> {
    return parseMessage(
      await request(`/${id}/messages`, {
        body: JSON.stringify({ content }),
        method: "POST",
      }),
    );
  }
  return { auth, create, list, messages, reply, send, storage };
}

type Client = ReturnType<typeof createClient>;
export { createClient, sessionKey };
export type { Client, Conversation, Message };
