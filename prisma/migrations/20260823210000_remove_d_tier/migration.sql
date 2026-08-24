BEGIN;

UPDATE "Placement" SET "tier" = 'F' WHERE "tier" = 'D';
UPDATE "Turn" SET "finalTier" = 'F' WHERE "finalTier" = 'D';

CREATE TYPE "Tier_next" AS ENUM ('S', 'A', 'B', 'C', 'F');

ALTER TABLE "Placement"
  ALTER COLUMN "tier" TYPE "Tier_next"
  USING ("tier"::text::"Tier_next");

ALTER TABLE "Turn"
  ALTER COLUMN "finalTier" TYPE "Tier_next"
  USING ("finalTier"::text::"Tier_next");

DROP TYPE "Tier";
ALTER TYPE "Tier_next" RENAME TO "Tier";

COMMIT;
