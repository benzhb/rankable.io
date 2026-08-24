import { z } from "zod";
import { endpointChangeSchema } from "./round.schema.js";

export const websocketClientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("authenticate"),
    token: z.string().min(1),
  }),
  endpointChangeSchema,
  z.object({
    type: z.literal("round.emote.send"),
    roundId: z.string().min(1),
    emote: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
  }),
]);

export type WebSocketClientFrame = z.infer<typeof websocketClientFrameSchema>;
