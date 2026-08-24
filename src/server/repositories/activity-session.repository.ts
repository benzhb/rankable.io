import type { PrismaClient } from "../../generated/prisma/client.js";

export class ActivitySessionRepository {
  constructor(readonly database: PrismaClient) {}

  findAggregate(sessionId: string) {
    return this.database.activitySession.findUnique({
      where: { id: sessionId },
      include: {
        mediaCatalog: true,
        participants: {
          where: { active: true },
          orderBy: { joinOrder: "asc" as const },
          include: { user: true },
        },
      },
    });
  }
}
