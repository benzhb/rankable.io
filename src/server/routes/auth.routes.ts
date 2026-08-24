import { Router } from "express";
import { authExchangeBodySchema, devAuthBodySchema } from "../../shared/index.js";
import type { AuthController } from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validate.js";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/exchange", validateBody(authExchangeBodySchema), controller.exchange);
  router.post("/dev", validateBody(devAuthBodySchema), controller.development);
  return router;
}
