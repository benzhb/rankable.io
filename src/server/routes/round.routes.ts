import { Router } from "express";
import {
  chaosClaimBodySchema,
  chaosPlacementBodySchema,
  democracyVoteBodySchema,
} from "../../shared/index.js";
import type { RoundController } from "../controllers/round.controller.js";
import type { AccessSessionRepository } from "../repositories/access-session.repository.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";

export function createRoundRouter(
  controller: RoundController,
  accessSessions: AccessSessionRepository,
): Router {
  const router = Router();
  router.use(authenticate(accessSessions));
  router.post("/:roundId/turn/end", controller.endTurn);
  router.post("/:roundId/end", controller.endGame);
  router.post("/:roundId/votes", validateBody(democracyVoteBodySchema), controller.vote);
  router.post("/:roundId/claims", validateBody(chaosClaimBodySchema), controller.claimCard);
  router.post(
    "/:roundId/claims/:cardId/place",
    validateBody(chaosPlacementBodySchema),
    controller.placeClaim,
  );
  return router;
}
