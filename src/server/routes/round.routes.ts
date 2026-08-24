import { Router } from "express";
import type { RoundController } from "../controllers/round.controller.js";
import type { AccessSessionRepository } from "../repositories/access-session.repository.js";
import { authenticate } from "../middleware/authenticate.js";

export function createRoundRouter(
  controller: RoundController,
  accessSessions: AccessSessionRepository,
): Router {
  const router = Router();
  router.use(authenticate(accessSessions));
  router.post("/:roundId/turn/end", controller.endTurn);
  return router;
}
