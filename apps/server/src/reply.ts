import type { SQL } from "bun";
import { getMessages } from "./conversations";
import type { ConversationStore, Message } from "./conversations";
import type { ReplyProvider } from "./provider";

interface ReplyOptions {
  store: ConversationStore;
  conversationId: string;
  messageId: string;
  generate: ReplyProvider;
  signal: AbortSignal;
  onDelta: (delta: string) => void;
}
const maximumReplyLength = 32_000;
const replyTimeout = 120_000;
const notFound = 404;
const conflict = 409;

function appendDelta(content: string, delta: string, onDelta: (delta: string) => void): string {
  const result = content + delta;
  if (result.length > maximumReplyLength) {
    throw new Error("Reply is too long");
  }
  onDelta(delta);
  return result;
}

async function collectReply(options: ReplyOptions, messages: Message[]): Promise<string> {
  let content = "";
  const prompt = messages.map(({ role, content: text }) => ({ content: text, role }));
  for await (const delta of options.generate(prompt, options.signal)) {
    options.signal.throwIfAborted();
    content = appendDelta(content, delta, options.onDelta);
  }
  options.signal.throwIfAborted();
  if (content.trim().length === 0) {
    throw new Error("Provider returned an empty reply");
  }
  return content;
}

async function lockHistory(database: SQL, options: ReplyOptions): Promise<Message[]> {
  const { store, conversationId, messageId } = options;
  const locked = await database<{ id: string }[]>`
    SELECT id FROM conversation WHERE id = ${conversationId} AND user_id = ${store.userId}
    FOR UPDATE NOWAIT
  `;
  if (locked.length === 0) {
    throw new Error("Conversation not found");
  }
  const messages = await getMessages({ database, userId: store.userId }, conversationId);
  const latest = messages?.at(-1);
  if (messages === null || latest?.id !== messageId || latest.role !== "user") {
    throw new Error("Message is no longer awaiting a reply");
  }
  return messages;
}

async function insertReply(
  database: SQL,
  conversationId: string,
  content: string,
): Promise<Message> {
  const [message] = await database<Message[]>`
    INSERT INTO message (conversation_id, content, role) VALUES (${conversationId}, ${content}, 'assistant')
    RETURNING id::text, content, role
  `;
  if (!message) {
    throw new Error("Reply insert returned no row");
  }
  await database`UPDATE conversation SET updated_at = now() WHERE id = ${conversationId}`;
  return message;
}

async function persistReply(options: ReplyOptions): Promise<Message> {
  return await options.store.database.begin(async (transaction) => {
    const messages = await lockHistory(transaction, options);
    const content = await collectReply(options, messages);
    return await insertReply(transaction, options.conversationId, content);
  });
}

function streamReply(
  request: Request,
  options: Omit<ReplyOptions, "signal" | "onDelta">,
): Response {
  const abort = new AbortController();
  const encoder = new TextEncoder();
  const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(replyTimeout)]);
  const body = new ReadableStream<Uint8Array>({
    cancel(): void {
      abort.abort();
    },
    async start(controller): Promise<void> {
      function emit(event: unknown): void {
        if (!request.signal.aborted && !abort.signal.aborted) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      }
      try {
        const message = await persistReply({
          ...options,
          onDelta: (delta) => {
            emit({ delta });
          },
          signal,
        });
        emit({ message });
      } catch {
        emit({ error: "Could not generate reply." });
      } finally {
        if (!request.signal.aborted && !abort.signal.aborted) {
          controller.close();
        }
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

function readMessageId(body: unknown): string | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("messageId" in body) ||
    typeof body.messageId !== "string"
  ) {
    return null;
  }
  return body.messageId;
}

function replyStatus(messages: Message[] | null, messageId: string): number | null {
  if (messages === null) {
    return notFound;
  }
  if (messages.at(-1)?.id !== messageId || messages.at(-1)?.role !== "user") {
    return conflict;
  }
  return null;
}

async function replyRoute(
  request: Request,
  options: { store: ConversationStore; conversationId: string; generate: ReplyProvider },
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  const messageId = readMessageId(await request.json().catch(() => null));
  if (messageId === null) {
    return new Response(null, { status: 400 });
  }
  const messages = await getMessages(options.store, options.conversationId);
  const status = replyStatus(messages, messageId);
  if (status !== null) {
    return new Response(null, { status });
  }
  return streamReply(request, { ...options, messageId });
}

export { replyRoute };
