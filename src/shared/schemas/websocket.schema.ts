import { z } from "zod";
import { endpointChangeSchema } from "./round.schema.js";

export const websocketClientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("authenticate"),
    token: z.string().min(1),
  }),
  endpointChangeSchema,
  z.object({
    type: z.literal("presentation.drag.started"),
    roundId: z.string().min(1),
    turnNumber: z.number().int().nonnegative(),
    cardId: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("presentation.drag.moved"),
    roundId: z.string().min(1),
    turnNumber: z.number().int().nonnegative(),
    cardId: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    sequence: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("presentation.drag.ended"),
    roundId: z.string().min(1),
    turnNumber: z.number().int().nonnegative(),
    cardId: z.string().min(1),
  }),
  z.object({
    type: z.literal("round.emote.send"),
    roundId: z.string().min(1),
    emote: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
  }),
]);

export type WebSocketClientFrame = z.infer<typeof websocketClientFrameSchema>;
