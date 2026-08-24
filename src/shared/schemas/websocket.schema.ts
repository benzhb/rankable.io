import { z } from "zod";
import { endpointChangeSchema } from "./round.schema.js";

export const websocketClientFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("authenticate"),
    token: z.string().min(1),
  }),
  endpointChangeSchema,
]);

export type WebSocketClientFrame = z.infer<typeof websocketClientFrameSchema>;
