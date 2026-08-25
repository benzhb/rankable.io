import type { PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "./infrastructure/prisma.js";
import { AccessSessionRepository } from "./repositories/access-session.repository.js";
import { ActivitySessionRepository } from "./repositories/activity-session.repository.js";
import { AuthService } from "./services/auth.service.js";
import { ConnectionLifecycleService } from "./services/connection-lifecycle.service.js";
import { DiscordApiService } from "./services/discord-api.service.js";
import { MediaCatalogService } from "./services/media-catalog.service.js";
import { RoundService } from "./services/round.service.js";
import { SessionEventBus } from "./services/session-event-bus.js";
import { SessionService } from "./services/session.service.js";
import { SnapshotService } from "./services/snapshot.service.js";
import { TimerSchedulerService } from "./services/timer-scheduler.service.js";
import { AuthController } from "./controllers/auth.controller.js";
import { HealthController } from "./controllers/health.controller.js";
import { MediaController } from "./controllers/media.controller.js";
import { RoundController } from "./controllers/round.controller.js";
import { SessionController } from "./controllers/session.controller.js";

export function createApplication(database: PrismaClient = prisma) {
  const events = new SessionEventBus();
  const timers = new TimerSchedulerService();
  const mediaCatalog = new MediaCatalogService(database);
  const snapshots = new SnapshotService(database);
  const accessSessions = new AccessSessionRepository(database);
  const sessionRepository = new ActivitySessionRepository(database);
  const auth = new AuthService(database, mediaCatalog);
  const discord = new DiscordApiService();
  const sessions = new SessionService(database, events, timers);
  const rounds = new RoundService(database, events, timers);
  sessions.setBeginRoundHandler((roundId) => rounds.beginRound(roundId));
  sessions.setTurnTimeoutHandler((roundId) => rounds.handleTurnTimeout(roundId));
  sessions.setRosterChangedHandler((roundId) => rounds.handleRosterChanged(roundId));
  const lifecycle = new ConnectionLifecycleService(sessions);

  return {
    database,
    events,
    timers,
    mediaCatalog,
    snapshots,
    accessSessions,
    sessionRepository,
    auth,
    discord,
    sessions,
    rounds,
    lifecycle,
    controllers: {
      auth: new AuthController(auth, discord, snapshots),
      health: new HealthController(database),
      media: new MediaController(mediaCatalog),
      round: new RoundController(rounds, snapshots),
      session: new SessionController(sessions, snapshots),
    },
  };
}

export type Application = ReturnType<typeof createApplication>;
