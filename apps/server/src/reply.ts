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

async function collectReply(options: ReplyOptions, messages: Message[]): Promise<string> {
  let content = "";
  const prompt = messages.map(({ role, content: text }) => ({ content: text, role }));
  for await (const delta of options.generate(prompt, options.signal)) {
    options.signal.throwIfAborted();
    content += delta;
    if (content.length > maximumReplyLength) {
      throw new Error("Reply is too long");
    }
    options.onDelta(delta);
  }
  options.signal.throwIfAborted();
  if (content.trim().length === 0) {
    throw new Error("Provider returned an empty reply");
  }
  return content;
}

async function persistReply(options: ReplyOptions): Promise<Message> {
  const { store, conversationId, messageId } = options;
  return await store.database.begin(async (transaction) => {
    const locked = await transaction`
      SELECT id FROM conversation WHERE id = ${conversationId} AND user_id = ${store.userId}
      FOR UPDATE NOWAIT
    `;
    if (locked.length === 0) {
      throw new Error("Conversation not found");
    }
    const messages = await getMessages(
      { database: transaction, userId: store.userId },
      conversationId,
    );
    const latest = messages?.at(-1);
    if (messages === null || latest?.id !== messageId || latest.role !== "user") {
      throw new Error("Message is no longer awaiting a reply");
    }
    const content = await collectReply(options, messages);
    const [message] = await transaction<Message[]>`
      INSERT INTO message (conversation_id, content, role) VALUES (${conversationId}, ${content}, 'assistant')
      RETURNING id::text, content, role
    `;
    if (!message) {
      throw new Error("Reply insert returned no row");
    }
    await transaction`UPDATE conversation SET updated_at = now() WHERE id = ${conversationId}`;
    return message;
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
    cancel() {
      abort.abort();
    },
    async start(controller) {
      function emit(event: unknown): void {
        if (!request.signal.aborted && !abort.signal.aborted) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      }
      try {
        const message = await persistReply({
          ...options,
          onDelta: (delta) => emit({ delta }),
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

async function replyRoute(
  request: Request,
  store: ConversationStore,
  conversationId: string,
  generate: ReplyProvider,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("messageId" in body) ||
    typeof body.messageId !== "string"
  ) {
    return new Response(null, { status: 400 });
  }
  const messages = await getMessages(store, conversationId);
  if (messages === null) {
    return new Response(null, { status: 404 });
  }
  if (messages.at(-1)?.id !== body.messageId || messages.at(-1)?.role !== "user") {
    return new Response(null, { status: 409 });
  }
  return streamReply(request, { conversationId, generate, messageId: body.messageId, store });
}

export { replyRoute };
