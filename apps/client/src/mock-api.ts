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

interface MockMessageRequest {
  body: BodyInit | null | undefined;
  conversationId: string;
  method: string;
  state: MockState;
}

const mockConversationId = "mock-conversation";
const mockMessageId = "mock-message";
const conversationsPath = "/api/conversations";
const messagesPath = "/messages";
const sessionPath = "/api/auth/get-session";
const signOutPath = "/api/auth/sign-out";
const statusOk = 200;
const statusNotFound = 404;
const statusMethodNotAllowed = 405;

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

function jsonResponse(body: unknown, status = statusOk): Response {
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
  const prefix = `${conversationsPath}/`;
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

function readMessageContent(body: BodyInit | null | undefined): string {
  if (typeof body !== "string") {
    throw new TypeError("Invalid mock message request");
  }
  const payload: unknown = JSON.parse(body);
  if (!isMessagePayload(payload)) {
    throw new TypeError("Invalid mock message");
  }
  return payload.content;
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

function createMessage(
  state: MockState,
  conversationId: string,
  body: BodyInit | null | undefined,
): Message {
  const message = {
    content: readMessageContent(body),
    id: `mock-message-${state.nextMessageId}`,
  };
  state.nextMessageId += 1;
  const messages = state.messages.get(conversationId) ?? [];
  messages.push(message);
  state.messages.set(conversationId, messages);
  return message;
}

function handleConversationsRequest(
  state: MockState,
  method: string,
): Response {
  if (method === "GET") {
    return jsonResponse(state.conversations);
  }
  if (method === "POST") {
    return jsonResponse(createConversation(state));
  }
  return jsonResponse({ error: "Method not allowed" }, statusMethodNotAllowed);
}

function handleMessagesRequest({
  body,
  conversationId,
  method,
  state,
}: MockMessageRequest): Response {
  if (method === "GET") {
    return jsonResponse(state.messages.get(conversationId) ?? []);
  }
  if (method === "POST") {
    return jsonResponse(createMessage(state, conversationId, body));
  }
  return jsonResponse({ error: "Method not allowed" }, statusMethodNotAllowed);
}

function handleRequest({ body, method, path, state }: MockRequest): Response {
  if (path === conversationsPath) {
    return handleConversationsRequest(state, method);
  }
  const conversationId = getConversationId(path);
  if (conversationId === null) {
    return jsonResponse({ error: "Not found" }, statusNotFound);
  }
  return handleMessagesRequest({
    body,
    conversationId,
    method,
    state,
  });
}

function createMockFetch(): typeof fetch {
  const state = createMockState();
  async function mockFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const path = getPath(input);
    let response = jsonResponse({});
    if (path === sessionPath) {
      response = jsonResponse({
        session: { id: "mock-session" },
        user: { id: "mock-user" },
      });
    } else if (path === signOutPath) {
      response = jsonResponse({});
    } else {
      response = handleRequest({
        body: init?.body,
        method: getMethod(input, init),
        path,
        state,
      });
    }
    return await Promise.resolve(response);
  }
  return Object.assign(mockFetch, { preconnect: fetch.preconnect });
}

export { createMockFetch };
