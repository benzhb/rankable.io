import type { MediaCard } from "./media.types.js";

export const TIERS = ["S", "A", "B", "C", "F"] as const;
export type Tier = (typeof TIERS)[number];
export type CardEndpoint = "BANK" | Tier;
export const GAME_MODES = ["PRESENTATION", "DEMOCRACY", "CHAOS"] as const;
export type GameMode = (typeof GAME_MODES)[number];
export type DemocracyChoice = Tier | "HAVENT_TRIED";
export type PlayerEmote = "THUMBS_UP" | "THUMBS_DOWN";

export interface PlayerEmoteEvent {
  roundId: string;
  participantId: string;
  emote: PlayerEmote;
  sentAt: string;
}

export interface QueuedPlayerSnapshot {
  participantId: string;
  username: string;
  avatarUrl: string;
  isCurrent: boolean;
  isSelf: boolean;
}

export interface PlacementSnapshot extends MediaCard {
  participantId: string | null;
  tier: Tier;
  sortIndex: number;
}

export interface DemocracyVoteSnapshot {
  participantId: string;
  username: string;
  avatarUrl: string;
  choice: DemocracyChoice;
  isSelf: boolean;
}

export interface ChaosClaimSnapshot extends MediaCard {
  participantId: string;
  username: string;
  isSelf: boolean;
}

export interface PresentationDragEvent {
  roundId: string;
  participantId: string;
  cardId: string;
  turnNumber: number;
  x: number;
  y: number;
  sequence: number;
}

export interface RoundSnapshot {
  id: string;
  status: "COUNTDOWN" | "PLAYING" | "RESULTS";
  categoryKey: string;
  gameMode: GameMode;
  playerQueue: QueuedPlayerSnapshot[];
  currentPlayerId: string | null;
  selectedCardId: string | null;
  currentEndpoint: CardEndpoint;
  endpointSequence: number;
  turnNumber: number;
  turnEndsAt: string | null;
  resultsEndsAt: string | null;
  lastSkippedCard: {
    title: string;
    count: number;
    skippedAt: string;
  } | null;
  cardBank: {
    remainingCount: number;
    visibleCards: MediaCard[];
  };
  placements: PlacementSnapshot[];
  democracy: {
    phase: "VOTING" | "REVEAL";
    revealEndsAt: string | null;
    lastResolvedCardId: string | null;
    votes: DemocracyVoteSnapshot[];
    eligibleVoterCount: number;
  } | null;
  chaos: {
    claims: ChaosClaimSnapshot[];
  } | null;
}
