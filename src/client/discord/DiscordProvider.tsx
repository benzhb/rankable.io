import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CardEndpoint } from "../../shared/types/round.types.js";
import type { SessionSnapshot } from "../../shared/types/session.types.js";
import { setSessionToken } from "../api/api-client.js";
import { endTurn as endTurnRequest } from "../api/round.api.js";
import {
  cancelCountdown as cancelCountdownRequest,
  joinLobby as joinLobbyRequest,
  leaveLobby as leaveLobbyRequest,
  startCountdown as startCountdownRequest,
} from "../api/session.api.js";
import { bootstrapDiscord } from "./discord-auth.js";

interface DiscordContextValue {
  snapshot: SessionSnapshot | null;
  loading: boolean;
  error: string | null;
  joinLobby: () => Promise<void>;
  leaveLobby: () => Promise<void>;
  startCountdown: (categoryKey: string) => Promise<void>;
  cancelCountdown: () => Promise<void>;
  endTurn: () => Promise<void>;
  moveCard: (to: CardEndpoint) => void;
}

const DiscordContext = createContext<DiscordContextValue | null>(null);

function socketUrl(): string {
  const url = new URL("/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function DiscordProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  const acceptSnapshot = useCallback((next: SessionSnapshot) => {
    setSnapshot((current) => (!current || next.version >= current.version ? next : current));
  }, []);

  const connect = useCallback((token: string) => {
    if (disposedRef.current) return;
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "authenticate", token }));
    });
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data)) as {
        type: string;
        snapshot?: SessionSnapshot;
        error?: { message?: string };
      };
      if (frame.type === "session.snapshot" && frame.snapshot) {
        acceptSnapshot(frame.snapshot);
        setError(null);
      } else if (frame.type === "error") {
        setError(frame.error?.message ?? "Real-time connection error");
      }
    });
    socket.addEventListener("close", () => {
      if (disposedRef.current) return;
      window.setTimeout(() => connect(token), 1_000);
    });
  }, [acceptSnapshot]);

  useEffect(() => {
    disposedRef.current = false;
    void bootstrapDiscord()
      .then((result) => {
        tokenRef.current = result.sessionToken;
        setSessionToken(result.sessionToken);
        acceptSnapshot(result.snapshot);
        connect(result.sessionToken);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to launch Rankable");
      })
      .finally(() => setLoading(false));

    return () => {
      disposedRef.current = true;
      socketRef.current?.close();
    };
  }, [acceptSnapshot, connect]);

  const run = useCallback(async (action: () => Promise<SessionSnapshot>) => {
    setError(null);
    try {
      acceptSnapshot(await action());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    }
  }, [acceptSnapshot]);

  const moveCard = useCallback((to: CardEndpoint) => {
    const current = snapshot;
    const round = current?.round;
    const socket = socketRef.current;
    const card = round?.cardBank.visibleCards[0];
    if (!round || !card || round.status !== "PLAYING" || !socket) return;
    if (round.currentPlayerId !== current.self.participantId || round.currentEndpoint === to) return;
    const sequence = round.endpointSequence + 1;
    socket.send(JSON.stringify({
      type: "turn.card.endpoint-changed",
      roundId: round.id,
      turnNumber: round.turnNumber,
      cardId: card.id,
      from: round.currentEndpoint,
      to,
      sequence,
    }));
    setSnapshot({
      ...current,
      round: { ...round, currentEndpoint: to, endpointSequence: sequence },
    });
  }, [snapshot]);

  const value = useMemo<DiscordContextValue>(() => ({
    snapshot,
    loading,
    error,
    joinLobby: () => run(joinLobbyRequest),
    leaveLobby: () => run(leaveLobbyRequest),
    startCountdown: (categoryKey) => run(() => startCountdownRequest(categoryKey)),
    cancelCountdown: () => run(cancelCountdownRequest),
    endTurn: async () => {
      if (snapshot?.round) await run(() => endTurnRequest(snapshot.round!.id));
    },
    moveCard,
  }), [snapshot, loading, error, run, moveCard]);

  return <DiscordContext.Provider value={value}>{children}</DiscordContext.Provider>;
}

export function useDiscordActivity(): DiscordContextValue {
  const context = useContext(DiscordContext);
  if (!context) throw new Error("useDiscordActivity must be used inside DiscordProvider");
  return context;
}
