import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { RoundService } from "../../src/server/services/round.service.js";
import type { SessionEventBus } from "../../src/server/services/session-event-bus.js";
import type { TimerSchedulerService } from "../../src/server/services/timer-scheduler.service.js";

describe("round turns", () => {
  it("lets the current player end their turn with the card still in the bank", async () => {
    const card = {
      id: "card-1",
      title: "Unknown show",
      imageUrl: "/media/cards/card-1",
      storagePath: "anime/unknown-show.webp",
    };
    const roundUpdate = vi.fn(async () => undefined);
    const placementCreate = vi.fn(async () => undefined);
    const turnCreate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          sessionId: "session-1",
          status: "PLAYING",
          turnEndsAt: new Date(Date.now() + 10_000),
          playerQueue: ["participant-1", "participant-2"],
          cardQueue: [card],
          currentEndpoint: "BANK",
          turnNumber: 3,
        })),
        update: roundUpdate,
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-1", active: true })),
      },
      placement: {
        count: vi.fn(async () => 0),
        create: placementCreate,
      },
      turn: { create: turnCreate },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const events = { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus;
    const timers = {
      cancel: vi.fn(),
      schedule: vi.fn(),
    } as unknown as TimerSchedulerService;
    const service = new RoundService(database, events, timers);

    await service.endTurn({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-1",
    }, "round-1");

    expect(placementCreate).not.toHaveBeenCalled();
    expect(turnCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: "card-1", finalTier: null }),
    });
    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({
        playerQueue: ["participant-2", "participant-1"],
        cardQueue: [card],
        currentEndpoint: "BANK",
      }),
    });
  });
});
