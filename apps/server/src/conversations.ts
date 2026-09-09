import type { SQL } from "bun";

interface ConversationStore {
  database: SQL;
  userId: string;
}

interface Conversation {
  id: string;
  title: string;
}

interface Message {
  id: string;
  content: string;
}

async function createConversation({ database, userId }: ConversationStore): Promise<Conversation> {
  const [conversation] = await database<Conversation[]>`
    INSERT INTO conversation (user_id) VALUES (${userId}) RETURNING id, title
  `;
  if (!conversation) {
    throw new Error("Conversation insert returned no row");
  }
  return conversation;
}

async function listConversations({ database, userId }: ConversationStore): Promise<Conversation[]> {
  return await database<Conversation[]>`
    SELECT id, title FROM conversation WHERE user_id = ${userId} ORDER BY updated_at DESC, id
  `;
}

async function getMessages(
  { database, userId }: ConversationStore,
  conversationId: string,
): Promise<Message[] | null> {
  const [conversation] = await database<Conversation[]>`
    SELECT id, title FROM conversation WHERE id = ${conversationId} AND user_id = ${userId}
  `;
  if (!conversation) {
    return null;
  }
  return await database<Message[]>`
    SELECT id::text, content FROM message
    WHERE conversation_id = ${conversationId} ORDER BY id
  `;
}

async function appendMessage(
  { database, userId }: ConversationStore,
  conversationId: string,
  content: string,
): Promise<Message | null> {
  return await database.begin(async (transaction) => {
    const [conversation] = await transaction<Conversation[]>`
      SELECT id, title FROM conversation WHERE id = ${conversationId} AND user_id = ${userId} FOR UPDATE
    `;
    if (!conversation) {
      return null;
    }
    await transaction`
      UPDATE conversation SET updated_at = now(),
        title = CASE WHEN EXISTS (SELECT 1 FROM message WHERE conversation_id = ${conversationId})
          THEN title ELSE left(${content}, 60) END
      WHERE id = ${conversationId} AND user_id = ${userId}
    `;
    const [message] = await transaction<Message[]>`
      INSERT INTO message (conversation_id, content) VALUES (${conversationId}, ${content})
      RETURNING id::text, content
    `;
    if (!message) {
      throw new Error("Message insert returned no row");
    }
    return message;
  });
}

async function deleteConversation(
  { database, userId }: ConversationStore,
  conversationId: string,
): Promise<boolean> {
  const deleted = await database<Conversation[]>`
    DELETE FROM conversation WHERE id = ${conversationId} AND user_id = ${userId} RETURNING id
  `;
  return deleted.length > 0;
}

export { appendMessage, createConversation, deleteConversation, getMessages, listConversations };
export type { Conversation, ConversationStore, Message };
