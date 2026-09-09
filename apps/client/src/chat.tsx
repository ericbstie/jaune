import { Sidebar } from "./sidebar";
import type { Client, Conversation } from "./api";
import { MessagePanel } from "./message-panel";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

interface ChatProps {
  client: Client;
  onSignOut: () => void;
}

function Chat({ client, onSignOut }: ChatProps): ReactElement {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const items = await client.list();
        if (active) {
          setConversations(items);
        }
      } catch {
        if (active) {
          setError("Could not load conversations.");
        }
      }
    }
    void load();
    return (): void => {
      active = false;
    };
  }, [client]);
  async function create(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const conversation = await client.create();
      setConversations((items) => [conversation, ...items]);
      setSelected(conversation.id);
    } catch {
      setError("Could not create conversation.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh(): Promise<void> {
    try {
      setConversations(await client.list());
    } catch {
      setError("Could not load conversations.");
    }
  }
  return (
    <main className="flex h-dvh bg-white text-neutral-950">
      <Sidebar
        conversations={conversations}
        selected={selected}
        busy={busy}
        onCreate={() => {
          void create();
        }}
        onSelect={setSelected}
        onSignOut={onSignOut}
      />
      <section aria-label="Chat" className="flex min-w-0 flex-1 flex-col p-4">
        {error.length > 0 && <p role="alert">{error}</p>}
        {selected !== null && (
          <MessagePanel
            key={selected}
            client={client}
            conversationId={selected}
            onSent={refresh}
            onBusy={setBusy}
          />
        )}
      </section>
    </main>
  );
}

export { Chat };
