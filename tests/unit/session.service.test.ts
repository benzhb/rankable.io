import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { SessionService } from "../../src/server/services/session.service.js";
import type { SessionEventBus } from "../../src/server/services/session-event-bus.js";
import type { TimerSchedulerService } from "../../src/server/services/timer-scheduler.service.js";

describe("session roster changes", () => {
  it("removes a disconnected Democracy voter before reconciling the vote", async () => {
    const deadline = new Date(Date.now() + 10_000);
    const roundUpdate = vi.fn(async () => undefined);
    const voteDelete = vi.fn(async () => ({ count: 1 }));
    const transaction = {
      activitySession: {
        findUnique: vi.fn(async () => ({
          id: "session-1",
          phase: "PLAYING",
          activeRoundId: "round-1",
          leaderParticipantId: "participant-1",
          countdownEndsAt: null,
        })),
        update: vi.fn(async () => undefined),
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-2", active: true })),
        update: vi.fn(async () => undefined),
        findFirst: vi.fn(async () => ({ id: "participant-1" })),
      },
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          gameMode: "DEMOCRACY",
          selectedCardId: "card-1",
          playerQueue: ["participant-1", "participant-2"],
          cardQueue: [{
            id: "card-1",
            title: "Current",
            imageUrl: "/media/cards/card-1",
            storagePath: "anime/current.webp",
          }],
          passParticipantIds: [],
          currentEndpoint: "BANK",
          endpointSequence: 0,
          turnNumber: 1,
          turnEndsAt: deadline,
        })),
        update: roundUpdate,
      },
      roundParticipant: { updateMany: vi.fn(async () => ({ count: 1 })) },
      democracyVote: { deleteMany: voteDelete },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const events = { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus;
    const service = new SessionService(
      database,
      events,
      { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService,
    );
    const reconcile = vi.fn(async () => undefined);
    service.setRosterChangedHandler(reconcile);

    await service.leave({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-2",
    }, "DISCONNECTED");

    expect(voteDelete).toHaveBeenCalledWith({
      where: {
        roundId: "round-1",
        cardId: "card-1",
        participantId: "participant-2",
      },
    });
    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({ playerQueue: ["participant-1"] }),
    });
    expect(reconcile).toHaveBeenCalledWith("round-1");
    expect(events.emit).toHaveBeenCalledWith("session-1");
  });
});
