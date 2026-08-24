import type { NextFunction, Request, Response } from "express";
import type { AuthExchangeBody, DevAuthBody } from "../models/controller-types.js";
import { isProduction } from "../config/env.js";
import { AppError } from "../models/app-error.js";
import type { AuthService } from "../services/auth.service.js";
import type { DiscordApiService } from "../services/discord-api.service.js";
import type { SnapshotService } from "../services/snapshot.service.js";

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly discord: DiscordApiService,
    private readonly snapshots: SnapshotService,
  ) {}

  exchange = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { code, instanceId } = request.body as AuthExchangeBody;
      const verified = await this.discord.exchangeAndVerify(code, instanceId);
      const application = await this.auth.createApplicationSession(instanceId, verified.user);
      response.json({
        discordAccessToken: verified.accessToken,
        sessionToken: application.sessionToken,
        snapshot: await this.snapshots.get(application.sessionId, verified.user.id),
      });
    } catch (error) {
      next(error);
    }
  };

  development = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (isProduction) throw new AppError(404, "NOT_FOUND", "Route not found");
      const body = request.body as DevAuthBody;
      const application = await this.auth.createApplicationSession(body.instanceId, {
        id: body.userId,
        username: body.username,
        globalName: body.username,
        avatarHash: null,
        avatarUrl:
          body.avatarUrl ??
          `https://cdn.discordapp.com/embed/avatars/${Math.abs(hashCode(body.userId)) % 6}.png`,
      });
      response.json({
        discordAccessToken: "development-access-token",
        sessionToken: application.sessionToken,
        snapshot: await this.snapshots.get(application.sessionId, body.userId),
      });
    } catch (error) {
      next(error);
    }
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return hash;
}
