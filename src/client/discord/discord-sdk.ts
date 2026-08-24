import { DiscordSDK } from "@discord/embedded-app-sdk";

let discordSdk: DiscordSDK | null = null;

export function getDiscordSdk(): DiscordSDK {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("VITE_DISCORD_CLIENT_ID is required");
  discordSdk ??= new DiscordSDK(clientId);
  return discordSdk;
}
