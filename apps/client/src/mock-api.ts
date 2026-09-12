import type { Conversation, Message } from "./api";

interface MockState {
  conversations: Conversation[];
  messages: Map<string, Message[]>;
  nextConversationId: number;
  nextMessageId: number;
}

interface MockRequest {
  body: BodyInit | null | undefined;
  method: string;
  path: string;
  state: MockState;
}

const mockConversationId = "mock-conversation";
const mockMessageId = "mock-message";
const conversationsPath = "/api/conversations";
const messagesPath = "/messages";
const sessionPath = "/api/auth/get-session";
const signOutPath = "/api/auth/sign-out";

function createMockState(): MockState {
  const conversation = {
    id: mockConversationId,
    title: "Mock conversation",
  };
  const message = {
    content: "Mock authentication is enabled.",
    id: mockMessageId,
  };
  return {
    conversations: [conversation],
    messages: new Map([[conversation.id, [message]]]),
    nextConversationId: 1,
    nextMessageId: 1,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function getPath(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return new URL(input.url).pathname;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return new URL(input).pathname;
}

function getMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): string {
  return init?.method ?? (input instanceof Request ? input.method : "GET");
}

function getConversationId(path: string): string | null {
  const prefix = conversationsPath + "/";
  if (!path.startsWith(prefix) || !path.endsWith(messagesPath)) {
    return null;
  }
  const conversationId = path.slice(prefix.length, -messagesPath.length);
  return conversationId.length > 0 ? conversationId : null;
}

function isMessagePayload(value: unknown): value is { content: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    typeof value.content === "string"
  );
}

function createConversation(state: MockState): Conversation {
  const conversation = {
    id: `mock-conversation-${state.nextConversationId}`,
    title: "New conversation",
  };
  state.nextConversationId += 1;
  state.conversations.unshift(conversation);
  state.messages.set(conversation.id, []);
  return conversation;
}

async function createMessage(
  state: MockState,
  conversationId: string,
  body: BodyInit | null | undefined,
): Promise<Message> {
  if (typeof body !== "string") {
    throw new TypeError("Invalid mock message request");
  }
  const payload: unknown = JSON.parse(body);
  if (!isMessagePayload(payload)) {
    throw new TypeError("Invalid mock message");
  }
  const message = {
    content: payload.content,
    id: `mock-message-${state.nextMessageId}`,
  };
  state.nextMessageId += 1;
  const messages = state.messages.get(conversationId) ?? [];
  messages.push(message);
  state.messages.set(conversationId, messages);
  return message;
}

async function handleRequest({
  body,
  method,
  path,
  state,
}: MockRequest): Promise<Response> {
  if (path === conversationsPath && method === "GET") {
    return jsonResponse(state.conversations);
  }
  if (path === conversationsPath && method === "POST") {
    return jsonResponse(createConversation(state));
  }
  const conversationId = getConversationId(path);
  if (conversationId === null) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  if (method === "GET") {
    return jsonResponse(state.messages.get(conversationId) ?? []);
  }
  if (method === "POST") {
    return jsonResponse(await createMessage(state, conversationId, body));
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

function createMockFetch(): typeof fetch {
  const state = createMockState();
  return async (input, init): Promise<Response> => {
    const path = getPath(input);
    if (path === sessionPath) {
      return jsonResponse({
        session: { id: "mock-session" },
        user: { id: "mock-user" },
      });
    }
    if (path === signOutPath) {
      return jsonResponse({});
    }
    return handleRequest({
      body: init?.body,
      method: getMethod(input, init),
      path,
      state,
    });
  };
}

export { createMockFetch };
