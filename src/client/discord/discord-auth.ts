import type { AuthExchangeResponse } from "../../shared/types/session.types.js";
import { authenticateDevelopmentUser, exchangeDiscordCode } from "../api/auth.api.js";
import { getDiscordSdk } from "./discord-sdk.js";

function developmentIdentity(): {
  instanceId: string;
  userId: string;
  username: string;
} {
  const parameters = new URLSearchParams(window.location.search);
  const username = parameters.get("username") ?? "Alex";
  return {
    instanceId: parameters.get("instance") ?? "local-rankable-instance",
    userId: parameters.get("user") ?? `dev-${username.toLowerCase().replace(/\W+/g, "-")}`,
    username,
  };
}

export async function bootstrapDiscord(): Promise<AuthExchangeResponse> {
  if (import.meta.env.VITE_DISCORD_MOCK === "true") {
    return authenticateDevelopmentUser(developmentIdentity());
  }

  const discordSdk = getDiscordSdk();
  await discordSdk.ready();
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string;
  const authorization = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    prompt: "none",
    scope: ["identify"],
  });
  if (!authorization?.code) throw new Error("Discord authorization failed");

  const exchanged = await exchangeDiscordCode(
    authorization.code,
    discordSdk.instanceId,
  );
  const authenticated = await discordSdk.commands.authenticate({
    access_token: exchanged.discordAccessToken,
  });
  if (!authenticated) throw new Error("Discord authentication failed");
  return exchanged;
}
