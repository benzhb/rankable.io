import { z } from "zod";

export const authExchangeBodySchema = z.object({
  code: z.string().min(1).max(2048),
  instanceId: z.string().min(1).max(256),
});

export const devAuthBodySchema = z.object({
  instanceId: z.string().min(1).max(256).default("local-instance"),
  userId: z.string().min(1).max(64),
  username: z.string().min(1).max(64),
  avatarUrl: z.string().max(4096).optional(),
});
