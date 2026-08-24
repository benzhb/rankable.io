import { z } from "zod";

export const startCountdownBodySchema = z.object({
  categoryKey: z.string().min(1).max(128),
});
