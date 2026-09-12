import type { Client } from "./api";
import type { ReactElement } from "react";
import { Chat } from "./chat";
import { SignIn } from "./sign-in";

interface SessionViewProps {
  checking: boolean;
  error: string;
  signedIn: boolean;
  client: Client;
  openURL: (url: string) => Promise<void>;
  onSignedIn: () => void;
  onSignOut: () => void;
}
function SessionView({
  checking,
  error,
  signedIn,
  client,
  openURL,
  onSignedIn,
  onSignOut,
}: SessionViewProps): ReactElement {
  if (checking) {
    return <main />;
  }
  if (error.length > 0) {
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (signedIn) {
    return (
      <Chat
        client={client}
        onSignOut={() => {
          onSignOut();
        }}
      />
    );
  }
  return <SignIn client={client} openURL={openURL} onSignedIn={onSignedIn} />;
}
export { SessionView };
