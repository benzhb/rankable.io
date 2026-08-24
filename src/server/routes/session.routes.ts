import { Router } from "express";
import { startCountdownBodySchema } from "../../shared/index.js";
import type { SessionController } from "../controllers/session.controller.js";
import type { AccessSessionRepository } from "../repositories/access-session.repository.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";

export function createSessionRouter(
  controller: SessionController,
  accessSessions: AccessSessionRepository,
): Router {
  const router = Router();
  router.use(authenticate(accessSessions));
  router.get("/", controller.show);
  router.post("/join", controller.join);
  router.post("/leave", controller.leave);
  router.post(
    "/countdown",
    validateBody(startCountdownBodySchema),
    controller.startCountdown,
  );
  router.delete("/countdown", controller.cancelCountdown);
  return router;
}
