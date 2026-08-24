import type { MediaCategorySummary } from "./media.types.js";
import type { RoundSnapshot } from "./round.types.js";

export type SessionPhase =
  | "LOBBY"
  | "COUNTDOWN"
  | "PLAYING"
  | "RESULTS"
  | "ENDED";

export interface LobbyMemberSnapshot {
  participantId: string;
  discordUserId: string;
  username: string;
  avatarUrl: string;
  isLeader: boolean;
  isSelf: boolean;
}

export interface SessionSnapshot {
  sessionId: string;
  version: number;
  serverTime: string;
  phase: SessionPhase;
  self: {
    userId: string;
    participantId: string | null;
    membership: "VIEWING" | "JOINED";
    isLeader: boolean;
  };
  capabilities: {
    canJoin: boolean;
    canLeave: boolean;
    canSelectCategory: boolean;
    canStartCountdown: boolean;
    canCancelCountdown: boolean;
    canEndTurn: boolean;
  };
  members: LobbyMemberSnapshot[];
  categories: MediaCategorySummary[];
  selectedCategoryKey: string | null;
  countdownEndsAt: string | null;
  round: RoundSnapshot | null;
}

export interface AuthExchangeResponse {
  discordAccessToken: string;
  sessionToken: string;
  snapshot: SessionSnapshot;
}
