import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthContext } from "../models/auth-context.js";
import { hashToken } from "../services/token.service.js";

export class AccessSessionRepository {
  constructor(private readonly database: PrismaClient) {}

  async authenticate(token: string): Promise<AuthContext | null> {
    const access = await this.database.accessSession.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!access || access.revokedAt || access.expiresAt <= new Date()) return null;
    return {
      accessSessionId: access.id,
      sessionId: access.sessionId,
      userId: access.userId,
    };
  }
}
