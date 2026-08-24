import "dotenv/config";

function integer(name: string, fallback: number, minimum = 1): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function hostname(name: string, value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  try {
    return new URL(input.includes("://") ? input : `https://${input}`).hostname;
  } catch {
    throw new Error(`${name} must be a valid hostname or URL`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: integer("PORT", 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://rankable:rankable_dev@localhost:5432/rankable",
  publicHostname: hostname("PUBLIC_HOSTNAME", process.env.PUBLIC_HOSTNAME),
  discordClientId:
    process.env.DISCORD_CLIENT_ID ?? process.env.VITE_DISCORD_CLIENT_ID ?? "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "rankable-media",
  supabaseMediaRoot: (process.env.SUPABASE_MEDIA_ROOT ?? "").replace(/^\/+|\/+$/g, ""),
  mediaSignedUrlTtlSeconds: integer("MEDIA_SIGNED_URL_TTL_SECONDS", 86_400),
  roundCardLimit: integer("ROUND_CARD_LIMIT", 20),
  sessionTokenTtlSeconds: integer("SESSION_TOKEN_TTL_SECONDS", 21_600),
  countdownSeconds: integer("COUNTDOWN_SECONDS", 10),
  turnSeconds: integer("TURN_SECONDS", 15),
  resultsSeconds: integer("RESULTS_SECONDS", 10),
  minPlayers: integer("MIN_PLAYERS", 2),
};

export const isProduction = env.nodeEnv === "production";
