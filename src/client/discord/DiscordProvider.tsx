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
import type {
  CardEndpoint,
  PlayerEmote,
  PlayerEmoteEvent,
} from "../../shared/types/round.types.js";
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
  emotes: Readonly<Record<string, PlayerEmoteEvent>>;
  sendEmote: (emote: PlayerEmote) => void;
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
  const [emotes, setEmotes] = useState<Record<string, PlayerEmoteEvent>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const emoteTimeoutsRef = useRef(new Map<string, number>());

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
        roundId?: string;
        participantId?: string;
        emote?: PlayerEmote;
        sentAt?: string;
      };
      if (frame.type === "session.snapshot" && frame.snapshot) {
        acceptSnapshot(frame.snapshot);
        setError(null);
      } else if (frame.type === "error") {
        setError(frame.error?.message ?? "Real-time connection error");
      } else if (
        frame.type === "round.emote" &&
        frame.roundId &&
        frame.participantId &&
        frame.emote &&
        frame.sentAt
      ) {
        const event: PlayerEmoteEvent = {
          roundId: frame.roundId,
          participantId: frame.participantId,
          emote: frame.emote,
          sentAt: frame.sentAt,
        };
        setEmotes((current) => ({ ...current, [event.participantId]: event }));
        const previousTimeout = emoteTimeoutsRef.current.get(event.participantId);
        if (previousTimeout) window.clearTimeout(previousTimeout);
        const timeout = window.setTimeout(() => {
          setEmotes((current) => {
            if (current[event.participantId]?.sentAt !== event.sentAt) return current;
            const next = { ...current };
            delete next[event.participantId];
            return next;
          });
          emoteTimeoutsRef.current.delete(event.participantId);
        }, 2_500);
        emoteTimeoutsRef.current.set(event.participantId, timeout);
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
      for (const timeout of emoteTimeoutsRef.current.values()) window.clearTimeout(timeout);
      emoteTimeoutsRef.current.clear();
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

  const sendEmote = useCallback((emote: PlayerEmote) => {
    const round = snapshot?.round;
    const socket = socketRef.current;
    if (!round || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "round.emote.send", roundId: round.id, emote }));
  }, [snapshot]);

  useEffect(() => {
    setEmotes({});
    for (const timeout of emoteTimeoutsRef.current.values()) window.clearTimeout(timeout);
    emoteTimeoutsRef.current.clear();
  }, [snapshot?.round?.id]);

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
    emotes,
    sendEmote,
  }), [snapshot, loading, error, run, moveCard, emotes, sendEmote]);

  return <DiscordContext.Provider value={value}>{children}</DiscordContext.Provider>;
}

export function useDiscordActivity(): DiscordContextValue {
  const context = useContext(DiscordContext);
  if (!context) throw new Error("useDiscordActivity must be used inside DiscordProvider");
  return context;
}
