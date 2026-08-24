import type { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";
import type { VerifiedDiscordIdentity } from "./discord-api.service.js";
import { createOpaqueToken, hashToken } from "./token.service.js";
import { MediaCatalogService } from "./media-catalog.service.js";

export class AuthService {
  constructor(
    private readonly database: PrismaClient,
    private readonly mediaCatalog: MediaCatalogService,
  ) {}

  async createApplicationSession(
    instanceId: string,
    identity: VerifiedDiscordIdentity,
  ): Promise<{ sessionId: string; sessionToken: string }> {
    const sessionToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + env.sessionTokenTtlSeconds * 1_000);

    const session = await this.database.$transaction(async (transaction) => {
      await transaction.discordUser.upsert({
        where: { id: identity.id },
        create: {
          id: identity.id,
          username: identity.username,
          globalName: identity.globalName,
          avatarHash: identity.avatarHash,
          avatarUrl: identity.avatarUrl,
        },
        update: {
          username: identity.username,
          globalName: identity.globalName,
          avatarHash: identity.avatarHash,
          avatarUrl: identity.avatarUrl,
        },
      });

      const activitySession = await transaction.activitySession.upsert({
        where: { discordInstanceId: instanceId },
        create: { discordInstanceId: instanceId },
        update: {},
      });

      await transaction.accessSession.create({
        data: {
          tokenHash: hashToken(sessionToken),
          userId: identity.id,
          sessionId: activitySession.id,
          expiresAt,
        },
      });
      return activitySession;
    });

    await this.mediaCatalog.ensureForSession(session.id);
    return { sessionId: session.id, sessionToken };
  }
}
