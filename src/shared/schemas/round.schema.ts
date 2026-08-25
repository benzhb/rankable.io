import { z } from "zod";

export const tierSchema = z.enum(["S", "A", "B", "C", "F"]);
export const gameModeSchema = z.enum(["PRESENTATION", "DEMOCRACY", "CHAOS"]);
export const democracyChoiceSchema = z.union([tierSchema, z.literal("HAVENT_TRIED")]);
export const cardEndpointSchema = z.enum([
  "BANK",
  "S",
  "A",
  "B",
  "C",
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

export const democracyVoteBodySchema = z.object({
  choice: democracyChoiceSchema,
});

export const chaosClaimBodySchema = z.object({
  cardId: z.string().min(1),
});

export const chaosPlacementBodySchema = z.object({
  tier: tierSchema,
});
