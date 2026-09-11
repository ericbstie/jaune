import { sessionKey } from "./api";
import type { Client } from "./api";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

interface SignInProps {
  client: Client;
  openURL: (url: string) => Promise<void>;
  onSignedIn: () => void;
  mockAuthentication: boolean;
}
interface PendingSignIn {
  deviceCode: string;
  userCode: string;
  verificationURL: string;
  interval: number;
  expiresAt: number;
}
const millisecondsPerSecond = 1000;
const slowdownSeconds = 5;

async function requestToken(
  client: Client,
  deviceCode: string,
): Promise<{ token: string | null; slowdown: boolean }> {
  const result = await client.auth.device.token({
    client_id: "jaune",
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  if (result.data !== null) {
    return { slowdown: false, token: result.data.access_token };
  }
  const reason = result.error.error;
  if (reason !== "authorization_pending" && reason !== "slow_down") {
    throw new Error("Sign-in failed");
  }
  return { slowdown: reason === "slow_down", token: null };
}

interface PollOptions {
  client: Client;
  pending: PendingSignIn;
  onSuccess: () => void;
  onError: () => void;
  now: () => number;
}
async function requestPendingToken({
  client,
  pending,
  now,
}: PollOptions): Promise<{ token: string | null; slowdown: boolean }> {
  if (now() >= pending.expiresAt) {
    throw new Error("Sign-in expired");
  }
  return await requestToken(client, pending.deviceCode);
}

function pollSignIn({
  client,
  pending,
  onSuccess,
  onError,
  now,
}: PollOptions): () => void {
  const state = { active: true, delay: pending.interval };
  function finish(token: string): void {
    client.storage.setItem(sessionKey, token);
    onSuccess();
  }
  function schedule(
    callback: () => Promise<void>,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      void callback();
    }, state.delay * millisecondsPerSecond);
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  function updatePoll(result: {
    token: string | null;
    slowdown: boolean;
  }): void {
    if (result.token !== null) {
      finish(result.token);
      return;
    }
    if (result.slowdown) {
      state.delay += slowdownSeconds;
    }
    // Tick is the next timed poll in this local recursion.
    // oxlint-disable-next-line eslint/no-use-before-define
    timer = schedule(tick);
  }
  async function tick(): Promise<void> {
    try {
      const result = await requestPendingToken({
        client,
        now,
        onError,
        onSuccess,
        pending,
      });
      if (!state.active) {
        return;
      }
      updatePoll(result);
    } catch {
      if (state.active) {
        onError();
      }
    }
  }
  timer = schedule(tick);
  return (): void => {
    state.active = false;
    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}

async function beginSignIn(
  client: Client,
  openURL: (url: string) => Promise<void>,
  now: () => number,
): Promise<PendingSignIn> {
  const result = await client.auth.device.code({ client_id: "jaune" });
  if (result.data === null) {
    throw new Error("Sign-in failed");
  }
  const { data } = result;
  await openURL(data.verification_uri_complete);
  return {
    deviceCode: data.device_code,
    expiresAt: now() + data.expires_in * millisecondsPerSecond,
    interval: data.interval,
    userCode: data.user_code,
    verificationURL: data.verification_uri_complete,
  };
}

function SignIn({
  client,
  openURL,
  onSignedIn,
  mockAuthentication,
}: SignInProps): ReactElement {
  const [pending, setPending] = useState<PendingSignIn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (pending === null) {
      return (): void => {
        /* No pending request to cancel. */
      };
    }
    return pollSignIn({
      client,
      now: Date.now,
      onError: () => {
        setPending(null);
        setError("Sign-in failed.");
      },
      onSuccess: onSignedIn,
      pending,
    });
  }, [client, pending, onSignedIn]);
  async function start(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      if (mockAuthentication) {
        onSignedIn();
        return;
      }
      setPending(await beginSignIn(client, openURL, Date.now));
    } catch {
      setError("Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-white text-neutral-950">
      <div>
        <button
          type="button"
          disabled={busy || pending !== null}
          onClick={() => {
            void start();
          }}
        >
          Sign in with Google
        </button>
        {pending !== null && (
          <p aria-label="Sign-in code">{pending.userCode}</p>
        )}
        {pending !== null && (
          <a href={pending.verificationURL} target="_blank" rel="noreferrer">
            Sign in with Google
          </a>
        )}
        {pending !== null && (
          <button
            type="button"
            onClick={() => {
              setPending(null);
            }}
          >
            Cancel
          </button>
        )}
        {error.length > 0 && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}

export { SignIn };
