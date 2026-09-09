import type { Client, Message } from "./api";
import { useEffect, useState } from "react";
import type { ReactElement, SubmitEvent } from "react";

interface MessagePanelProps {
  client: Client;
  conversationId: string;
  onSent: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}
const maximumContentLength = 32_000;

function MessagePanel({
  client,
  conversationId,
  onSent,
  onBusy,
}: MessagePanelProps): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const items = await client.messages(conversationId);
        if (active) {
          setMessages(items);
          setReady(true);
        }
      } catch {
        if (active) {
          setError("Could not load messages.");
        }
      }
    }
    void load();
    return (): void => {
      active = false;
    };
  }, [client, conversationId]);
  async function persist(): Promise<void> {
    try {
      const message = await client.send(conversationId, draft);
      setMessages((items) => [...items, message]);
      setDraft("");
      await onSent();
    } catch {
      setError("Could not send message.");
    } finally {
      setSending(false);
      onBusy(false);
    }
  }
  function send(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (draft.trim().length === 0 || sending || !ready) {
      return;
    }
    setSending(true);
    onBusy(true);
    setError("");
    void persist();
  }
  return (
    <>
      <ol
        aria-label="Messages"
        aria-busy={!ready}
        className="flex-1 space-y-4 overflow-y-auto"
      >
        {messages.map((message) => (
          <li key={message.id} className="whitespace-pre-wrap break-words">
            {message.content}
          </li>
        ))}
      </ol>
      {error.length > 0 && <p role="alert">{error}</p>}
      <form
        className="flex gap-2 border-t border-neutral-200 pt-3"
        onSubmit={send}
      >
        <input
          aria-label="Message"
          className="min-w-0 flex-1 border border-neutral-300 p-2"
          value={draft}
          maxLength={maximumContentLength}
          disabled={!ready || sending}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
        />
        <button
          type="submit"
          disabled={!ready || sending || draft.trim().length === 0}
        >
          Send
        </button>
      </form>
    </>
  );
}

export { MessagePanel };
