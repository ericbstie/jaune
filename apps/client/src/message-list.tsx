import type { Message } from "./api";
import type { ReactElement } from "react";

interface MessageListProps {
  messages: Message[];
  ready: boolean;
  reply: string;
}

function MessageList({
  messages,
  ready,
  reply,
}: MessageListProps): ReactElement {
  return (
    <ol
      aria-label="Messages"
      aria-busy={!ready}
      className="flex-1 space-y-4 overflow-y-auto"
    >
      {messages.map((message) => (
        <li
          key={message.id}
          aria-label={message.role}
          className="whitespace-pre-wrap break-words aria-[label=user]:text-right"
        >
          {message.content}
        </li>
      ))}
      {reply.length > 0 && (
        <li aria-label="assistant" className="whitespace-pre-wrap break-words">
          {reply}
        </li>
      )}
    </ol>
  );
}

export { MessageList };
