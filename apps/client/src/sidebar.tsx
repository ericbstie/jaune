import type { Conversation } from "./api";
import type { ReactElement } from "react";

interface SidebarProps {
  conversations: Conversation[];
  selected: string | null;
  busy: boolean;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onSignOut: () => void;
}

function Sidebar({
  conversations,
  selected,
  busy,
  onCreate,
  onSelect,
  onSignOut,
}: SidebarProps): ReactElement {
  return (
    <aside
      aria-label="Conversations"
      className="flex w-36 shrink-0 flex-col gap-4 border-r border-neutral-200 p-3 sm:w-52"
    >
      <button type="button" disabled={busy} onClick={onCreate}>
        New conversation
      </button>
      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            aria-pressed={selected === conversation.id}
            disabled={busy}
            className="truncate text-left aria-pressed:font-semibold"
            onClick={() => {
              onSelect(conversation.id);
            }}
          >
            {conversation.title}
          </button>
        ))}
      </nav>
      <button type="button" disabled={busy} onClick={onSignOut}>
        Sign out
      </button>
    </aside>
  );
}

export { Sidebar };
