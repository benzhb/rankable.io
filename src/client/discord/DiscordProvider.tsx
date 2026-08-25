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
  DemocracyChoice,
  GameMode,
  PlayerEmote,
  PlayerEmoteEvent,
  PresentationDragEvent,
  Tier,
} from "../../shared/types/round.types.js";
import type { SessionSnapshot } from "../../shared/types/session.types.js";
import { setSessionToken } from "../api/api-client.js";
import {
  castVote as castVoteRequest,
  claimCard as claimCardRequest,
  endGame as endGameRequest,
  endTurn as endTurnRequest,
  placeClaim as placeClaimRequest,
} from "../api/round.api.js";
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
  startCountdown: (categoryKey: string, gameMode: GameMode) => Promise<void>;
  cancelCountdown: () => Promise<void>;
  endTurn: () => Promise<void>;
  endGame: () => Promise<void>;
  castVote: (choice: DemocracyChoice) => Promise<void>;
  claimChaosCard: (cardId: string) => Promise<void>;
  placeChaosCard: (cardId: string, tier: Tier) => Promise<void>;
  moveCard: (to: CardEndpoint) => void;
  presentationDrag: PresentationDragEvent | null;
  startPresentationDrag: (cardId: string, x: number, y: number) => void;
  movePresentationDrag: (cardId: string, x: number, y: number) => void;
  endPresentationDrag: (cardId: string) => void;
  emotes: Readonly<Record<string, PlayerEmoteEvent>>;
  sendEmote: (emote: PlayerEmote) => void;
}

const DiscordContext = createContext<DiscordContextValue | null>(null);

function socketUrl(): string {
  const url = new URL("/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function dragMatchesSnapshot(
  drag: PresentationDragEvent,
  snapshot: SessionSnapshot | null,
): boolean {
  const round = snapshot?.round;
  return Boolean(
    round &&
      round.status === "PLAYING" &&
      round.gameMode === "PRESENTATION" &&
      round.id === drag.roundId &&
      round.turnNumber === drag.turnNumber &&
      round.currentPlayerId === drag.participantId &&
      round.selectedCardId === drag.cardId &&
      !round.placements.some((placement) => placement.id === drag.cardId),
  );
}

export function DiscordProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emotes, setEmotes] = useState<Record<string, PlayerEmoteEvent>>({});
  const [presentationDrag, setPresentationDrag] = useState<PresentationDragEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<SessionSnapshot | null>(null);
  const tokenRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const emoteTimeoutsRef = useRef(new Map<string, number>());
  const dragSequenceRef = useRef(0);
  const lastDragSentAtRef = useRef(0);

  const acceptSnapshot = useCallback((next: SessionSnapshot) => {
    const current = snapshotRef.current;
    if (current && next.version < current.version) return;
    snapshotRef.current = next;
    setSnapshot(next);
    setPresentationDrag((drag) => drag && dragMatchesSnapshot(drag, next) ? drag : null);
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
        cardId?: string;
        turnNumber?: number;
        x?: number;
        y?: number;
        sequence?: number;
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
      } else if (
        frame.type === "presentation.drag.position" &&
        frame.roundId &&
        frame.participantId &&
        frame.cardId &&
        frame.turnNumber !== undefined &&
        frame.x !== undefined &&
        frame.y !== undefined &&
        frame.sequence !== undefined
      ) {
        const nextDrag: PresentationDragEvent = {
          roundId: frame.roundId,
          participantId: frame.participantId,
          cardId: frame.cardId,
          turnNumber: frame.turnNumber,
          x: frame.x,
          y: frame.y,
          sequence: frame.sequence,
        };
        if (dragMatchesSnapshot(nextDrag, snapshotRef.current)) {
          setPresentationDrag(nextDrag);
        }
      } else if (frame.type === "presentation.drag.ended" && frame.roundId) {
        setPresentationDrag((current) => current?.roundId === frame.roundId ? null : current);
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
    const card = round?.cardBank.visibleCards.find(
      (candidate) => candidate.id === round.selectedCardId,
    );
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

  const startPresentationDrag = useCallback((cardId: string, x: number, y: number) => {
    const round = snapshot?.round;
    const socket = socketRef.current;
    if (!round || round.gameMode !== "PRESENTATION" || socket?.readyState !== WebSocket.OPEN) return;
    dragSequenceRef.current = 0;
    lastDragSentAtRef.current = performance.now();
    socket.send(JSON.stringify({
      type: "presentation.drag.started",
      roundId: round.id,
      turnNumber: round.turnNumber,
      cardId,
      x,
      y,
    }));
    setSnapshot((current) => {
      const currentRound = current?.round;
      if (!current || !currentRound || currentRound.id !== round.id) return current;
      const changingCard = currentRound.selectedCardId !== cardId;
      return {
        ...current,
        round: {
          ...currentRound,
          selectedCardId: cardId,
          currentEndpoint: changingCard ? "BANK" : currentRound.currentEndpoint,
          endpointSequence: changingCard ? 0 : currentRound.endpointSequence,
        },
      };
    });
  }, [snapshot]);

  const movePresentationDrag = useCallback((cardId: string, x: number, y: number) => {
    const round = snapshot?.round;
    const socket = socketRef.current;
    const now = performance.now();
    if (
      !round ||
      round.gameMode !== "PRESENTATION" ||
      socket?.readyState !== WebSocket.OPEN ||
      now - lastDragSentAtRef.current < 50
    ) return;
    lastDragSentAtRef.current = now;
    const sequence = ++dragSequenceRef.current;
    socket.send(JSON.stringify({
      type: "presentation.drag.moved",
      roundId: round.id,
      turnNumber: round.turnNumber,
      cardId,
      x,
      y,
      sequence,
    }));
  }, [snapshot]);

  const endPresentationDrag = useCallback((cardId: string) => {
    const round = snapshot?.round;
    const socket = socketRef.current;
    if (!round || round.gameMode !== "PRESENTATION" || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "presentation.drag.ended",
      roundId: round.id,
      turnNumber: round.turnNumber,
      cardId,
    }));
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

  useEffect(() => setPresentationDrag(null), [snapshot?.round?.id, snapshot?.round?.turnNumber]);

  const value = useMemo<DiscordContextValue>(() => ({
    snapshot,
    loading,
    error,
    joinLobby: () => run(joinLobbyRequest),
    leaveLobby: () => run(leaveLobbyRequest),
    startCountdown: (categoryKey, gameMode) =>
      run(() => startCountdownRequest(categoryKey, gameMode)),
    cancelCountdown: () => run(cancelCountdownRequest),
    endTurn: async () => {
      if (snapshot?.round) await run(() => endTurnRequest(snapshot.round!.id));
    },
    endGame: async () => {
      if (snapshot?.round) await run(() => endGameRequest(snapshot.round!.id));
    },
    castVote: async (choice) => {
      if (snapshot?.round) await run(() => castVoteRequest(snapshot.round!.id, choice));
    },
    claimChaosCard: async (cardId) => {
      if (snapshot?.round) await run(() => claimCardRequest(snapshot.round!.id, cardId));
    },
    placeChaosCard: async (cardId, tier) => {
      if (snapshot?.round) await run(() => placeClaimRequest(snapshot.round!.id, cardId, tier));
    },
    moveCard,
    presentationDrag,
    startPresentationDrag,
    movePresentationDrag,
    endPresentationDrag,
    emotes,
    sendEmote,
  }), [
    snapshot,
    loading,
    error,
    run,
    moveCard,
    presentationDrag,
    startPresentationDrag,
    movePresentationDrag,
    endPresentationDrag,
    emotes,
    sendEmote,
  ]);

  return <DiscordContext.Provider value={value}>{children}</DiscordContext.Provider>;
}

export function useDiscordActivity(): DiscordContextValue {
  const context = useContext(DiscordContext);
  if (!context) throw new Error("useDiscordActivity must be used inside DiscordProvider");
  return context;
}
