import { sessionKey } from "./api";
import type { Client } from "./api";
import { SessionView } from "./session-view";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

interface AppProps {
  client: Client;
  openURL: (url: string) => Promise<void>;
}

function App({ client, openURL }: AppProps): ReactElement {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const completeSignIn = useCallback(() => {
    setSignedIn(true);
  }, []);
  useEffect(() => {
    let active = true;
    async function check(): Promise<void> {
      try {
        const result = await client.auth.getSession();
        if (active) {
          setSignedIn(result.data !== null);
        }
        if (result.error) {
          throw new Error("Session request failed");
        }
      } catch {
        if (active) {
          setError("Could not connect to server.");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }
    void check();
    return (): void => {
      active = false;
    };
  }, [client]);
  async function signOut(): Promise<void> {
    try {
      const result = await client.auth.signOut();
      if (result.error) {
        throw new Error("Sign-out request failed");
      }
      client.storage.removeItem(sessionKey);
      setSignedIn(false);
    } catch {
      setError("Could not sign out.");
    }
  }
  return (
    <SessionView
      checking={checking}
      error={error}
      signedIn={signedIn}
      client={client}
      openURL={openURL}
      onSignedIn={completeSignIn}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}

export { App };
