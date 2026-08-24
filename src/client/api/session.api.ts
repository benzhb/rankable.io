import type { SessionSnapshot } from "../../shared/types/session.types.js";
import { apiRequest } from "./api-client.js";

export const getSession = () => apiRequest<SessionSnapshot>("/api/session");
export const joinLobby = () =>
  apiRequest<SessionSnapshot>("/api/session/join", { method: "POST" });
export const leaveLobby = () =>
  apiRequest<SessionSnapshot>("/api/session/leave", { method: "POST" });
export const startCountdown = (categoryKey: string) =>
  apiRequest<SessionSnapshot>("/api/session/countdown", {
    method: "POST",
    body: JSON.stringify({ categoryKey }),
  });
export const cancelCountdown = () =>
  apiRequest<SessionSnapshot>("/api/session/countdown", { method: "DELETE" });
