import { env } from "../config/env.js";
import { AppError } from "../models/app-error.js";

interface DiscordTokenResponse {
  access_token: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface VerifiedDiscordIdentity {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  avatarUrl: string;
}

function avatarUrl(user: DiscordUserResponse): string {
  if (user.avatar) {
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
  }
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

export class DiscordApiService {
  async exchangeAndVerify(code: string, instanceId: string): Promise<{
    accessToken: string;
    user: VerifiedDiscordIdentity;
  }> {
    if (!env.discordClientId || !env.discordClientSecret || !env.discordBotToken) {
      throw new AppError(503, "DISCORD_NOT_CONFIGURED", "Discord credentials are not configured");
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.discordClientId,
        client_secret: env.discordClientSecret,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!tokenResponse.ok) {
      throw new AppError(401, "DISCORD_CODE_REJECTED", "Discord rejected the authorization code");
    }
    const token = (await tokenResponse.json()) as DiscordTokenResponse;

    const [userResponse, instanceResponse] = await Promise.all([
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
      fetch(
        `https://discord.com/api/applications/${env.discordClientId}/activity-instances/${encodeURIComponent(instanceId)}`,
        { headers: { Authorization: `Bot ${env.discordBotToken}` } },
      ),
    ]);
    if (!userResponse.ok) {
      throw new AppError(401, "DISCORD_USER_REJECTED", "Unable to retrieve the Discord user");
    }
    if (!instanceResponse.ok) {
      throw new AppError(403, "INACTIVE_ACTIVITY_INSTANCE", "The Discord Activity instance is not active");
    }

    const user = (await userResponse.json()) as DiscordUserResponse;
    return {
      accessToken: token.access_token,
      user: {
        id: user.id,
        username: user.username,
        globalName: user.global_name ?? null,
        avatarHash: user.avatar ?? null,
        avatarUrl: avatarUrl(user),
      },
    };
  }
}
