import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Reply, RoomView, Session } from "../shared/types";

function storageKey(kind: string, code: string) {
  return kind === "host" ? "double-agent:host" : `double-agent:player:${code}`;
}
function savedSession(): Session | null {
  const code =
    new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";
  const key =
    location.pathname === "/host"
      ? storageKey("host", "")
      : storageKey("player", code);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function useGame() {
  const [room, setRoom] = useState<RoomView | null>(null),
    [session, setSession] = useState<Session | null>(savedSession);
  const [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const socket = useRef<Socket | null>(null),
    sessionRef = useRef(session);
  const offset = useRef(0);
  function save(s: Session) {
    sessionRef.current = s;
    setSession(s);
    localStorage.setItem(storageKey(s.kind, s.code), JSON.stringify(s));
    history.replaceState(
      null,
      "",
      s.kind === "host" ? "/host" : `/join?room=${s.code}`,
    );
  }
  useEffect(() => {
    const s = io({ autoConnect: false });
    socket.current = s;
    s.on("state", (state: RoomView) => {
      offset.current = state.serverNow - Date.now();
      setRoom(state);
    });
    s.on("connect", async () => {
      if (sessionRef.current) {
        try {
          const response: Reply<{ session: Session }> = await s
            .timeout(6000)
            .emitWithAck("resume", sessionRef.current);
          if (!response.ok) {
            localStorage.removeItem(
              storageKey(sessionRef.current.kind, sessionRef.current.code),
            );
            sessionRef.current = null;
            setSession(null);
            setRoom(null);
            setError(response.error);
          }
        } catch {
          setError("Could not restore your seat. Reconnect to try again.");
          s.disconnect();
          s.connect();
          return;
        }
      }
      setConnected(true);
    });
    s.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect")
        setError(
          "This connection was closed. Your seat may be open in another tab.",
        );
    });
    s.on("connect_error", () => {
      setConnected(false);
    });
    s.on("removed", () => {
      const previous = sessionRef.current;
      if (previous)
        localStorage.removeItem(storageKey(previous.kind, previous.code));
      sessionRef.current = null;
      setSession(null);
      setRoom(null);
      setError("The host removed your seat from the lobby.");
      // The server disconnects next; return to a clean unauthenticated connection.
      setTimeout(() => s.connect(), 100);
    });
    s.connect();
    return () => {
      s.disconnect();
    };
  }, []);
  async function send<T extends object = object>(
    event: string,
    data: unknown = null,
  ): Promise<T | null> {
    if (!socket.current?.connected || !connected) {
      setError("Reconnecting to the server. Please wait.");
      return null;
    }
    setError("");
    try {
      const reply: Reply<T> = await socket.current
        .timeout(6000)
        .emitWithAck(event, data);
      if (!reply.ok) {
        setError(reply.error);
        return null;
      }
      return reply;
    } catch {
      setError("No response from the server. Please try again.");
      return null;
    }
  }
  async function enter(event: "create" | "join", data?: unknown) {
    setBusy(true);
    const reply = await send<{ session: Session }>(event, data);
    if (reply) save(reply.session);
    setBusy(false);
  }
  return {
    room,
    session,
    connected,
    error,
    busy,
    offset,
    send,
    enter,
    clearError: () => setError(""),
  };
}
export type GameConnection = ReturnType<typeof useGame>;
