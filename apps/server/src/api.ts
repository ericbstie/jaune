import { replyRoute } from "./reply";
import type { ReplyProvider } from "./provider";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
} from "./conversations";
import type { ConversationStore } from "./conversations";

const maximumContentLength = 32_000;

function parseContent(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("content" in body)) {
    return null;
  }
  if (typeof body.content !== "string") {
    return null;
  }
  const content = body.content.trim();
  if (content.length === 0 || content.length > maximumContentLength) {
    return null;
  }
  return content;
}

async function sendMessage(
  request: Request,
  store: ConversationStore,
  conversationId: string,
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const content = parseContent(body);
  if (content === null) {
    return new Response(null, { status: 400 });
  }
  const message = await appendMessage(store, conversationId, content);
  if (message === null) {
    return new Response(null, { status: 404 });
  }
  return Response.json(message, { status: 201 });
}

async function messageRoute(
  request: Request,
  store: ConversationStore,
  conversationId: string,
): Promise<Response> {
  if (request.method === "POST") {
    return await sendMessage(request, store, conversationId);
  }
  if (request.method !== "GET") {
    return new Response(null, { status: 405 });
  }
  const messages = await getMessages(store, conversationId);
  if (messages === null) {
    return new Response(null, { status: 404 });
  }
  return Response.json(messages);
}

async function collectionRoute(request: Request, store: ConversationStore): Promise<Response> {
  if (request.method === "GET") {
    return Response.json(await listConversations(store));
  }
  if (request.method === "POST") {
    return Response.json(await createConversation(store), { status: 201 });
  }
  return new Response(null, { status: 405 });
}

async function removeConversation(
  request: Request,
  store: ConversationStore,
  conversationId: string,
): Promise<Response> {
  if (request.method !== "DELETE") {
    return new Response(null, { status: 405 });
  }
  const deleted = await deleteConversation(store, conversationId);
  if (!deleted) {
    return new Response(null, { status: 404 });
  }
  return new Response(null, { status: 204 });
}

function conversationRoute(
  request: Request,
  options: {
    store: ConversationStore;
    generate: ReplyProvider;
    groups: Record<string, string | undefined>;
  },
): Promise<Response> | Response {
  const conversationId = options.groups["id"] ?? "";

  if (options.groups["action"] === "/reply") {
    return replyRoute(request, {
      conversationId,
      generate: options.generate,
      store: options.store,
    });
  }
  if (options.groups["action"] === "/messages") {
    return messageRoute(request, options.store, conversationId);
  }
  return removeConversation(request, options.store, conversationId);
}

function handleConversations(
  request: Request,
  store: ConversationStore,
  generate: ReplyProvider,
): Promise<Response> | Response {
  const path = new URL(request.url).pathname;
  if (path === "/api/conversations") {
    return collectionRoute(request, store);
  }
  const match = /^\/api\/conversations\/(?<id>[^/]+)(?<action>\/messages|\/reply)?$/u.exec(path);
  if (!match?.groups) {
    return new Response(null, { status: 404 });
  }
  return conversationRoute(request, { generate, groups: match.groups, store });
}

export { handleConversations, parseContent };
