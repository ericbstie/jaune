import type { ReactElement, SubmitEvent } from "react";

interface MessageFormProps {
  draft: string;
  ready: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}
const maximumContentLength = 32_000;

function MessageForm({ draft, ready, onChange, onSubmit }: MessageFormProps): ReactElement {
  return (
    <form className="flex gap-2 border-t border-neutral-200 pt-3" onSubmit={onSubmit}>
      <input
        aria-label="Message"
        className="min-w-0 flex-1 border border-neutral-300 p-2"
        value={draft}
        maxLength={maximumContentLength}
        disabled={!ready}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <button type="submit" disabled={!ready || draft.trim().length === 0}>
        Send
      </button>
    </form>
  );
}

export { MessageForm };
