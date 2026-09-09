import authMigration from "../migrations/001-auth.sql" with { type: "text" };
import type { SQL } from "bun";

export async function migrate(database: SQL): Promise<void> {
  await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(748192)`;
    await transaction.unsafe(authMigration);
    await transaction`
      CREATE TABLE IF NOT EXISTS conversation (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title text NOT NULL DEFAULT 'New conversation',
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await transaction`
      CREATE TABLE IF NOT EXISTS message (
        id bigserial PRIMARY KEY,
        conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
        content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 32000)
      )
    `;
    await transaction`CREATE INDEX IF NOT EXISTS conversation_user ON conversation (user_id, updated_at DESC)`;
    await transaction`CREATE INDEX IF NOT EXISTS message_conversation_id ON message (conversation_id, id)`;
  });
}
