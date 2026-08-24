CREATE TYPE "SessionPhase" AS ENUM ('LOBBY', 'COUNTDOWN', 'PLAYING', 'RESULTS', 'ENDED');
CREATE TYPE "RoundStatus" AS ENUM ('COUNTDOWN', 'PLAYING', 'RESULTS', 'COMPLETE', 'CANCELED');
CREATE TYPE "Tier" AS ENUM ('S', 'A', 'B', 'C', 'D', 'F');
CREATE TYPE "TurnEndReason" AS ENUM ('MANUAL', 'TIMEOUT', 'DISCONNECTED');

CREATE TABLE "DiscordUser" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "globalName" TEXT,
  "avatarHash" TEXT,
  "avatarUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySession" (
  "id" TEXT NOT NULL,
  "discordInstanceId" TEXT NOT NULL,
  "phase" "SessionPhase" NOT NULL DEFAULT 'LOBBY',
  "leaderParticipantId" TEXT,
  "selectedCategoryKey" TEXT,
  "activeRoundId" TEXT,
  "countdownEndsAt" TIMESTAMP(3),
  "resultsEndsAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "nextJoinOrder" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaCatalogSnapshot" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaCatalogSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Round" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "status" "RoundStatus" NOT NULL DEFAULT 'COUNTDOWN',
  "playerQueue" JSONB NOT NULL,
  "cardQueue" JSONB NOT NULL,
  "currentEndpoint" TEXT NOT NULL DEFAULT 'BANK',
  "endpointSequence" INTEGER NOT NULL DEFAULT 0,
  "turnNumber" INTEGER NOT NULL DEFAULT 0,
  "turnEndsAt" TIMESTAMP(3),
  "resultsEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoundParticipant" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "initialQueuePosition" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "RoundParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Turn" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "turnNumber" INTEGER NOT NULL,
  "cardId" TEXT,
  "finalTier" "Tier",
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "endedReason" "TurnEndReason" NOT NULL,
  CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Placement" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "tier" "Tier" NOT NULL,
  "sortIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivitySession_discordInstanceId_key" ON "ActivitySession"("discordInstanceId");
CREATE UNIQUE INDEX "Participant_sessionId_userId_key" ON "Participant"("sessionId", "userId");
CREATE INDEX "Participant_sessionId_active_joinOrder_idx" ON "Participant"("sessionId", "active", "joinOrder");
CREATE UNIQUE INDEX "AccessSession_tokenHash_key" ON "AccessSession"("tokenHash");
CREATE INDEX "AccessSession_sessionId_userId_idx" ON "AccessSession"("sessionId", "userId");
CREATE INDEX "AccessSession_expiresAt_idx" ON "AccessSession"("expiresAt");
CREATE UNIQUE INDEX "MediaCatalogSnapshot_sessionId_key" ON "MediaCatalogSnapshot"("sessionId");
CREATE INDEX "Round_sessionId_status_idx" ON "Round"("sessionId", "status");
CREATE UNIQUE INDEX "RoundParticipant_roundId_participantId_key" ON "RoundParticipant"("roundId", "participantId");
CREATE INDEX "RoundParticipant_roundId_active_initialQueuePosition_idx" ON "RoundParticipant"("roundId", "active", "initialQueuePosition");
CREATE UNIQUE INDEX "Turn_roundId_turnNumber_key" ON "Turn"("roundId", "turnNumber");
CREATE UNIQUE INDEX "Placement_roundId_cardId_key" ON "Placement"("roundId", "cardId");
CREATE INDEX "Placement_roundId_tier_sortIndex_idx" ON "Placement"("roundId", "tier", "sortIndex");

ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DiscordUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessSession" ADD CONSTRAINT "AccessSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessSession" ADD CONSTRAINT "AccessSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DiscordUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaCatalogSnapshot" ADD CONSTRAINT "MediaCatalogSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Round" ADD CONSTRAINT "Round_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundParticipant" ADD CONSTRAINT "RoundParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
