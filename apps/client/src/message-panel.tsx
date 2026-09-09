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
  const [status, setStatus] = useState({ error: "", ready: false, reply: "", sending: false });
  const abort = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const items = await client.messages(conversationId);
        if (active) {
          setMessages(items);
          setStatus((current) => ({ ...current, ready: true }));
        }
      } catch {
        if (active) {
          setStatus((current) => ({
            ...current,
            error: "Could not load messages.",
          }));
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
    setStatus((current) => ({ ...current, error: "", reply: "" }));
    await onSent();
  }
  async function persist(): Promise<void> {
    const controller = new AbortController();
    abort.current = controller;
    try {
      const message = await saveDraft();
      await answer(message, controller.signal);
    } catch {
      setStatus((current) => ({ ...current, error: "Could not complete reply.", reply: "" }));
    } finally {
      setStatus((current) => ({ ...current, reply: "", sending: false }));
      abort.current = null;
      onBusy(false);
    }
  }
  function send(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (draft.trim().length === 0 || status.sending || !status.ready) {
      return;
    }
    setStatus((current) => ({ ...current, error: "", reply: "", sending: true }));
    onBusy(true);
    void persist();
  }
  return (
    <>
      <MessageList messages={messages} ready={status.ready} reply={status.reply} />
      {status.error.length > 0 && <p role="alert">{status.error}</p>}
      <MessageForm
        draft={draft}
        ready={status.ready && !status.sending}
        onChange={setDraft}
        onSubmit={send}
      />
    </>
  );
}

export { MessagePanel };
