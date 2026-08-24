import type { AuthExchangeResponse } from "../../shared/types/session.types.js";
import { apiRequest } from "./api-client.js";

export function exchangeDiscordCode(code: string, instanceId: string) {
  return apiRequest<AuthExchangeResponse>("/api/auth/exchange", {
    method: "POST",
    body: JSON.stringify({ code, instanceId }),
  });
}

export function authenticateDevelopmentUser(input: {
  instanceId: string;
  userId: string;
  username: string;
}) {
  return apiRequest<AuthExchangeResponse>("/api/auth/dev", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
