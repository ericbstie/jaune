import { sessionKey } from "./api";
import type { Client } from "./api";
import { SessionView } from "./session-view";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

interface AppProps {
  client: Client;
  openURL: (url: string) => Promise<void>;
  mockAuthentication: boolean;
}

function App({
  client,
  openURL,
  mockAuthentication,
}: AppProps): ReactElement {
  const [signedIn, setSignedIn] = useState(mockAuthentication);
  const [checking, setChecking] = useState(!mockAuthentication);
  const [error, setError] = useState("");
  const completeSignIn = useCallback(() => {
    setSignedIn(true);
  }, []);
  useEffect(() => {
    if (mockAuthentication) {
      return;
    }
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
  }, [client, mockAuthentication]);
  async function signOut(): Promise<void> {
    if (mockAuthentication) {
      setSignedIn(false);
      return;
    }
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
      mockAuthentication={mockAuthentication}
      openURL={openURL}
      onSignedIn={completeSignIn}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}

export { App };
