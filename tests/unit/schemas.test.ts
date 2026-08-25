import { describe, expect, it } from "vitest";
import {
  authExchangeBodySchema,
  endpointChangeSchema,
  startCountdownBodySchema,
  websocketClientFrameSchema,
} from "../../src/shared/index.js";

describe("public schemas", () => {
  it("accepts the Discord exchange contract", () => {
    expect(authExchangeBodySchema.parse({ code: "oauth", instanceId: "instance" }))
      .toEqual({ code: "oauth", instanceId: "instance" });
  });

  it("rejects unknown categories with empty keys", () => {
    expect(startCountdownBodySchema.safeParse({ categoryKey: "" }).success).toBe(false);
  });

  it("requires a supported game mode when starting", () => {
    expect(startCountdownBodySchema.safeParse({
      categoryKey: "anime",
      gameMode: "DEMOCRACY",
    }).success).toBe(true);
    expect(startCountdownBodySchema.safeParse({
      categoryKey: "anime",
      gameMode: "SOLITAIRE",
    }).success).toBe(false);
  });

  it("accepts semantic endpoint changes", () => {
    const frame = {
      type: "turn.card.endpoint-changed" as const,
      roundId: "round-1",
      turnNumber: 2,
      cardId: "card-1",
      from: "S" as const,
      to: "A" as const,
      sequence: 3,
    };
    expect(endpointChangeSchema.parse(frame)).toEqual(frame);
    expect(websocketClientFrameSchema.parse(frame)).toEqual(frame);
  });

  it("rejects raw pointer movement frames", () => {
    expect(websocketClientFrameSchema.safeParse({
      type: "turn.drag.moved",
      x: 10,
      y: 20,
    }).success).toBe(false);
  });

  it("accepts normalized Presentation drag positions", () => {
    expect(websocketClientFrameSchema.safeParse({
      type: "presentation.drag.moved",
      roundId: "round-1",
      turnNumber: 3,
      cardId: "card-2",
      x: 0.42,
      y: 0.73,
      sequence: 4,
    }).success).toBe(true);
    expect(websocketClientFrameSchema.safeParse({
      type: "presentation.drag.moved",
      roundId: "round-1",
      turnNumber: 3,
      cardId: "card-2",
      x: 420,
      y: 730,
      sequence: 4,
    }).success).toBe(false);
  });

  it("rejects the removed D tier endpoint", () => {
    expect(endpointChangeSchema.safeParse({
      type: "turn.card.endpoint-changed",
      roundId: "round-1",
      turnNumber: 2,
      cardId: "card-1",
      from: "BANK",
      to: "D",
      sequence: 3,
    }).success).toBe(false);
  });

  it("accepts only the supported round emotes", () => {
    expect(websocketClientFrameSchema.safeParse({
      type: "round.emote.send",
      roundId: "round-1",
      emote: "THUMBS_UP",
    }).success).toBe(true);
    expect(websocketClientFrameSchema.safeParse({
      type: "round.emote.send",
      roundId: "round-1",
      emote: "PARTY_PARROT",
    }).success).toBe(false);
  });
});
