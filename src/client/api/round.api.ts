import type { SessionSnapshot } from "../../shared/types/session.types.js";
import type { DemocracyChoice, Tier } from "../../shared/types/round.types.js";
import { apiRequest } from "./api-client.js";

export const endTurn = (roundId: string) =>
  apiRequest<SessionSnapshot>(`/api/rounds/${encodeURIComponent(roundId)}/turn/end`, {
    method: "POST",
  });

export const endGame = (roundId: string) =>
  apiRequest<SessionSnapshot>(`/api/rounds/${encodeURIComponent(roundId)}/end`, {
    method: "POST",
  });

export const castVote = (roundId: string, choice: DemocracyChoice) =>
  apiRequest<SessionSnapshot>(`/api/rounds/${encodeURIComponent(roundId)}/votes`, {
    method: "POST",
    body: JSON.stringify({ choice }),
  });

export const claimCard = (roundId: string, cardId: string) =>
  apiRequest<SessionSnapshot>(`/api/rounds/${encodeURIComponent(roundId)}/claims`, {
    method: "POST",
    body: JSON.stringify({ cardId }),
  });

export const placeClaim = (roundId: string, cardId: string, tier: Tier) =>
  apiRequest<SessionSnapshot>(
    `/api/rounds/${encodeURIComponent(roundId)}/claims/${encodeURIComponent(cardId)}/place`,
    { method: "POST", body: JSON.stringify({ tier }) },
  );
