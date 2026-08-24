import { z } from "zod";

export const tierSchema = z.enum(["S", "A", "B", "C", "D", "F"]);
export const cardEndpointSchema = z.enum([
  "BANK",
  "S",
  "A",
  "B",
  "C",
  "D",
  "F",
]);

export const endpointChangeSchema = z.object({
  type: z.literal("turn.card.endpoint-changed"),
  roundId: z.string().min(1),
  turnNumber: z.number().int().nonnegative(),
  cardId: z.string().min(1),
  from: cardEndpointSchema,
  to: cardEndpointSchema,
  sequence: z.number().int().positive(),
});
