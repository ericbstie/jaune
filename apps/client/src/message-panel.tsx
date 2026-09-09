import { MessageForm } from "./message-form";
import { MessageList } from "./message-list";
import type { Client, Message } from "./api";
import { useEffect, useRef, useState } from "react";
import type { ReactElement, SubmitEvent } from "react";

interface MessagePanelProps {
  client: Client;
  conversationId: string;
  onSent: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}

function MessagePanel({
  client,
  conversationId,
  onSent,
  onBusy,
}: MessagePanelProps): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState({ error: "", reply: "" });
  const abort = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
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
          setStatus((current) => ({ ...current, error: "Could not load messages." }));
        }
      }
    }
    void load();
    return (): void => {
      active = false;
      abort.current?.abort();
    };
  }, [client, conversationId]);
  async function saveDraft(): Promise<Message> {
    const message = await client.send(conversationId, draft);
    setMessages((items) => [...items, message]);
    setDraft("");
    return message;
  }
  async function answer(message: Message, signal: AbortSignal): Promise<void> {
    const assistant = await client.reply(conversationId, {
      messageId: message.id,
      onDelta: (delta) => {
        setStatus((current) => ({ ...current, reply: current.reply + delta }));
      },
      signal,
    });
    setMessages((items) => [...items, assistant]);
    setStatus({ error: "", reply: "" });
    await onSent();
  }
  function finish(): void {
    setStatus((current) => ({ ...current, reply: "" }));
    abort.current = null;
    setSending(false);
    onBusy(false);
  }
  async function persist(): Promise<void> {
    const controller = new AbortController();
    abort.current = controller;
    try {
      const message = await saveDraft();
      await answer(message, controller.signal);
    } catch {
      setStatus({ error: "Could not complete reply.", reply: "" });
    } finally {
      finish();
    }
  }
  function send(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (draft.trim().length === 0 || sending || !ready) {
      return;
    }
    setSending(true);
    onBusy(true);
    setStatus({ error: "", reply: "" });
    void persist();
  }
  return (
    <>
      <MessageList messages={messages} ready={ready} reply={status.reply} />
      {status.error.length > 0 && <p role="alert">{status.error}</p>}
      <MessageForm draft={draft} ready={ready && !sending} onChange={setDraft} onSubmit={send} />
    </>
  );
}

export { MessagePanel };
