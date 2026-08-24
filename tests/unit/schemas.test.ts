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
});
