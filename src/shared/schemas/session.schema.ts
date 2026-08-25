import { z } from "zod";
import { gameModeSchema } from "./round.schema.js";

export const startCountdownBodySchema = z.object({
  categoryKey: z.string().min(1).max(128),
  gameMode: gameModeSchema,
});
