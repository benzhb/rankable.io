import { describe, expect, it } from "vitest";
import { dragMatchesSnapshot } from "../../src/client/discord/DiscordProvider.js";
import type { PresentationDragEvent } from "../../src/shared/types/round.types.js";
import type { SessionSnapshot } from "../../src/shared/types/session.types.js";

const drag: PresentationDragEvent = {
  roundId: "round-1",
  participantId: "participant-1",
  cardId: "card-1",
  turnNumber: 3,
  x: 0.5,
  y: 0.5,
  sequence: 4,
};

function snapshot(overrides: Record<string, unknown> = {}): SessionSnapshot {
  return {
    round: {
      id: "round-1",
      status: "PLAYING",
      gameMode: "PRESENTATION",
      turnNumber: 3,
      currentPlayerId: "participant-1",
      selectedCardId: "card-1",
      placements: [],
      ...overrides,
    },
  } as unknown as SessionSnapshot;
}

describe("Presentation drag visibility", () => {
  it("keeps a current drag and rejects late frames after placement", () => {
    expect(dragMatchesSnapshot(drag, snapshot())).toBe(true);
    expect(dragMatchesSnapshot(drag, snapshot({
      selectedCardId: null,
      turnNumber: 4,
      placements: [{ id: "card-1" }],
    }))).toBe(false);
  });
});
