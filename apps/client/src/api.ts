import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

interface Conversation {
  id: string;
  title: string;
}
interface Message {
  id: string;
  content: string;
}
const sessionKey = "jaune.session";
const mockConversationId = "mock-conversation";
const mockMessageId = "mock-message";

interface MockState {
  conversations: Conversation[];
  messages: Map<string, Message[]>;
  nextConversationId: number;
  nextMessageId: number;
}

function createMockState(): MockState {
  return {
    conversations: [
      { id: mockConversationId, title: "Mock conversation" },
    ],
    messages: new Map([
      [
        mockConversationId,
        [
          {
            id: mockMessageId,
            content: "Mock authentication is enabled.",
          },
        ],
      ],
    ]),
    nextConversationId: 1,
    nextMessageId: 1,
  };
}

function mockRequest(
  state: MockState,
  path: string,
  options: RequestInit,
): unknown {
  const method = options.method ?? "GET";
  if (path === "") {
    if (method === "GET") {
      return state.conversations;
    }
    if (method === "POST") {
      const conversation = {
        id: "mock-conversation-" + state.nextConversationId,
        title: "New conversation",
      };
      state.nextConversationId += 1;
      state.conversations.unshift(conversation);
      state.messages.set(conversation.id, []);
      return conversation;
    }
  }
  const messagePath = "/messages";
  if (!path.startsWith("/") || !path.endsWith(messagePath)) {
    throw new Error("Unsupported mock request");
  }
  const conversationId = path.slice(1, -messagePath.length);
  if (conversationId.length === 0) {
    throw new Error("Invalid mock conversation");
  }
  if (method === "GET") {
    return state.messages.get(conversationId) ?? [];
  }
  if (method === "POST") {
    if (typeof options.body !== "string") {
      throw new Error("Invalid mock message request");
    }
    const body = JSON.parse(options.body) as { content?: unknown };
    if (typeof body.content !== "string") {
      throw new Error("Invalid mock message");
    }
    const message = {
      id: "mock-message-" + state.nextMessageId,
      content: body.content,
    };
    state.nextMessageId += 1;
    const messages = state.messages.get(conversationId) ?? [];
    messages.push(message);
    state.messages.set(conversationId, messages);
    return message;
  }
  throw new Error("Unsupported mock request");
}

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
    typeof value.id !== "string" ||
    typeof value.content !== "string"
  ) {
    throw new Error("Invalid message response");
  }
  return { content: value.content, id: value.id };
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
  mockAuthentication = false,
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
  const mockState = mockAuthentication ? createMockState() : null;
  async function request(
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    if (mockState !== null) {
      return mockRequest(mockState, path, options);
    }
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
    return await response.json();
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
  return { auth, create, list, messages, send, storage };
}

type Client = ReturnType<typeof createClient>;
export { createClient, sessionKey };
export type { Client, Conversation, Message };
