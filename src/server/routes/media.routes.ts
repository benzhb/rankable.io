import { Router } from "express";
import type { MediaController } from "../controllers/media.controller.js";

export function createMediaRouter(controller: MediaController): Router {
  const router = Router();
  router.get("/cards/:cardId", controller.showCard);
  return router;
}
