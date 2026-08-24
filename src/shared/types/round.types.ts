import type { MediaCard } from "./media.types.js";

export const TIERS = ["S", "A", "B", "C", "F"] as const;
export type Tier = (typeof TIERS)[number];
export type CardEndpoint = "BANK" | Tier;
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
  participantId: string;
  tier: Tier;
  sortIndex: number;
}

export interface RoundSnapshot {
  id: string;
  status: "COUNTDOWN" | "PLAYING" | "RESULTS";
  categoryKey: string;
  playerQueue: QueuedPlayerSnapshot[];
  currentPlayerId: string | null;
  currentEndpoint: CardEndpoint;
  endpointSequence: number;
  turnNumber: number;
  turnEndsAt: string | null;
  resultsEndsAt: string | null;
  lastSkippedCard: {
    title: string;
    skippedAt: string;
  } | null;
  cardBank: {
    remainingCount: number;
    visibleCards: MediaCard[];
  };
  placements: PlacementSnapshot[];
}
