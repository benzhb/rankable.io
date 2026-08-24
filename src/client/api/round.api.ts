import type { SessionSnapshot } from "../../shared/types/session.types.js";
import { apiRequest } from "./api-client.js";

export const endTurn = (roundId: string) =>
  apiRequest<SessionSnapshot>(`/api/rounds/${encodeURIComponent(roundId)}/turn/end`, {
    method: "POST",
  });
