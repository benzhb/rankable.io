CREATE TYPE "GameMode" AS ENUM ('PRESENTATION', 'DEMOCRACY', 'CHAOS');

ALTER TABLE "ActivitySession"
ADD COLUMN "selectedGameMode" "GameMode" NOT NULL DEFAULT 'PRESENTATION';

ALTER TABLE "Round"
ADD COLUMN "gameMode" "GameMode" NOT NULL DEFAULT 'PRESENTATION',
ADD COLUMN "selectedCardId" TEXT,
ADD COLUMN "passParticipantIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "lastSkippedCardCount" INTEGER;

ALTER TABLE "Placement"
ALTER COLUMN "participantId" DROP NOT NULL;

ALTER TABLE "Placement"
DROP CONSTRAINT "Placement_participantId_fkey";

ALTER TABLE "Placement"
ADD CONSTRAINT "Placement_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DemocracyVote" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "tier" "Tier",
  "hasntTried" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemocracyVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChaosClaim" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChaosClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemocracyVote_roundId_cardId_participantId_key"
ON "DemocracyVote"("roundId", "cardId", "participantId");
CREATE INDEX "DemocracyVote_roundId_cardId_idx"
ON "DemocracyVote"("roundId", "cardId");
CREATE UNIQUE INDEX "ChaosClaim_roundId_cardId_key"
ON "ChaosClaim"("roundId", "cardId");
CREATE UNIQUE INDEX "ChaosClaim_roundId_participantId_key"
ON "ChaosClaim"("roundId", "participantId");
CREATE INDEX "ChaosClaim_roundId_idx" ON "ChaosClaim"("roundId");

ALTER TABLE "DemocracyVote"
ADD CONSTRAINT "DemocracyVote_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemocracyVote"
ADD CONSTRAINT "DemocracyVote_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChaosClaim"
ADD CONSTRAINT "ChaosClaim_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChaosClaim"
ADD CONSTRAINT "ChaosClaim_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
