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
          gameMode: "PRESENTATION",
          turnEndsAt: new Date(Date.now() + 10_000),
          playerQueue: ["participant-1", "participant-2"],
          cardQueue: [card],
          selectedCardId: null,
          passParticipantIds: [],
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
      data: expect.objectContaining({ cardId: undefined, finalTier: null }),
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

  it("trashes the same five-card window after every active player passes", async () => {
    const skippedCards = Array.from({ length: 5 }, (_, index) => ({
      id: `card-${index + 1}`,
      title: `Skipped ${index + 1}`,
      imageUrl: `/media/cards/card-${index + 1}`,
      storagePath: `anime/skipped-${index + 1}.webp`,
    }));
    const nextCard = {
      id: "card-6",
      title: "Next Card",
      imageUrl: "/media/cards/card-6",
      storagePath: "anime/next-card.webp",
    };
    const roundUpdate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          sessionId: "session-1",
          status: "PLAYING",
          gameMode: "PRESENTATION",
          turnEndsAt: new Date(Date.now() + 10_000),
          playerQueue: ["participant-1", "participant-2"],
          cardQueue: [...skippedCards, nextCard],
          selectedCardId: null,
          passParticipantIds: ["participant-2"],
          currentEndpoint: "BANK",
          turnNumber: 4,
        })),
        update: roundUpdate,
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-1", active: true })),
      },
      placement: {
        count: vi.fn(async () => 0),
        create: vi.fn(async () => undefined),
      },
      turn: { create: vi.fn(async () => undefined) },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const service = new RoundService(
      database,
      { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus,
      { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService,
    );

    await service.endTurn({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-1",
    }, "round-1");

    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({
        cardQueue: [nextCard],
        lastSkippedCardTitle: "5 cards",
        lastSkippedCardCount: 5,
        lastSkippedAt: expect.any(Date),
      }),
    });
  });

  it("allows active round players to emote", async () => {
    const database = {
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          sessionId: "session-1",
          status: "PLAYING",
          playerQueue: ["participant-1", "participant-2"],
        })),
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-2", active: true })),
      },
    } as unknown as PrismaClient;
    const service = new RoundService(
      database,
      {} as SessionEventBus,
      {} as TimerSchedulerService,
    );

    await expect(service.participantForEmote({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-2",
    }, "round-1")).resolves.toBe("participant-2");
  });

  it("skips a Democracy card when every response is Haven't tried", async () => {
    const firstCard = {
      id: "card-1",
      title: "Unseen",
      imageUrl: "/media/cards/card-1",
      storagePath: "anime/unseen.webp",
    };
    const nextCard = {
      id: "card-2",
      title: "Next",
      imageUrl: "/media/cards/card-2",
      storagePath: "anime/next.webp",
    };
    const baseRound = {
      id: "round-1",
      sessionId: "session-1",
      status: "PLAYING",
      gameMode: "DEMOCRACY",
      selectedCardId: "card-1",
      playerQueue: ["participant-1"],
      cardQueue: [firstCard, nextCard],
      turnEndsAt: new Date(Date.now() + 10_000),
    };
    const roundUpdate = vi.fn(async () => undefined);
    const voteCreate = vi.fn(async () => undefined);
    const placementCreate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async ({ include }: { include?: unknown }) =>
          include
            ? {
                ...baseRound,
                democracyVotes: [{
                  participantId: "participant-1",
                  cardId: "card-1",
                  tier: null,
                  hasntTried: true,
                }],
              }
            : baseRound),
        update: roundUpdate,
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-1", active: true })),
      },
      democracyVote: {
        findUnique: vi.fn(async () => null),
        create: voteCreate,
      },
      placement: {
        count: vi.fn(async () => 0),
        create: placementCreate,
      },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const service = new RoundService(
      database,
      { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus,
      { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService,
    );

    await service.castDemocracyVote({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-1",
    }, "round-1", "HAVENT_TRIED");

    expect(voteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tier: null, hasntTried: true }),
    });
    expect(placementCreate).not.toHaveBeenCalled();
    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({
        cardQueue: [nextCard],
        selectedCardId: null,
        lastResolvedCardId: "card-1",
        turnEndsAt: expect.any(Date),
        lastSkippedCardTitle: "Unseen",
        lastSkippedCardCount: 1,
      }),
    });
  });

  it("starts the next Democracy vote after the reveal pause", async () => {
    const nextCard = {
      id: "card-2",
      title: "Next",
      imageUrl: "/media/cards/card-2",
      storagePath: "anime/next.webp",
    };
    const round = {
      id: "round-1",
      sessionId: "session-1",
      status: "PLAYING",
      gameMode: "DEMOCRACY",
      selectedCardId: null,
      lastResolvedCardId: "card-1",
      cardQueue: [nextCard],
      turnEndsAt: new Date(Date.now() - 1_000),
    };
    const update = vi.fn(async () => undefined);
    const transaction = {
      round: { findUnique: vi.fn(async () => round), update },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      round: { findUnique: vi.fn(async () => round) },
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const timers = { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService;
    const events = { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus;
    const service = new RoundService(database, events, timers);

    await service.handleTurnTimeout("round-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({
        selectedCardId: "card-2",
        lastResolvedCardId: null,
        turnEndsAt: expect.any(Date),
      }),
    });
    expect(events.emit).toHaveBeenCalledWith("session-1");
  });

  it("resolves a Democracy vote when a disconnect leaves only players who already voted", async () => {
    const card = {
      id: "card-1",
      title: "Current",
      imageUrl: "/media/cards/card-1",
      storagePath: "anime/current.webp",
    };
    const nextCard = {
      id: "card-2",
      title: "Next",
      imageUrl: "/media/cards/card-2",
      storagePath: "anime/next.webp",
    };
    const votingRound = {
      id: "round-1",
      sessionId: "session-1",
      status: "PLAYING",
      gameMode: "DEMOCRACY",
      selectedCardId: "card-1",
      playerQueue: ["participant-1"],
      cardQueue: [card, nextCard],
      turnEndsAt: new Date(Date.now() + 10_000),
    };
    const revealDeadline = new Date(Date.now() + 5_000);
    const latestRound = {
      ...votingRound,
      selectedCardId: null,
      cardQueue: [nextCard],
      turnEndsAt: revealDeadline,
    };
    const placementCreate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          ...votingRound,
          democracyVotes: [{
            participantId: "participant-1",
            cardId: "card-1",
            tier: "A",
            hasntTried: false,
          }],
        })),
        update: vi.fn(async () => undefined),
      },
      placement: { count: vi.fn(async () => 0), create: placementCreate },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const findRound = vi
      .fn()
      .mockResolvedValueOnce(votingRound)
      .mockResolvedValueOnce(latestRound);
    const database = {
      round: { findUnique: findRound },
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const timers = { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService;
    const events = { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus;
    const service = new RoundService(database, events, timers);

    await service.handleRosterChanged("round-1");

    expect(placementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: "card-1", tier: "A" }),
    });
    expect(timers.schedule).toHaveBeenLastCalledWith(
      "turn:round-1",
      revealDeadline,
      expect.any(Function),
    );
    expect(events.emit).toHaveBeenCalledWith("session-1");
  });

  it("keeps the Democracy deadline armed when players are still waiting to vote", async () => {
    const deadline = new Date(Date.now() + 10_000);
    const round = {
      id: "round-1",
      sessionId: "session-1",
      status: "PLAYING",
      gameMode: "DEMOCRACY",
      selectedCardId: "card-1",
      playerQueue: ["participant-1", "participant-2"],
      cardQueue: [{
        id: "card-1",
        title: "Current",
        imageUrl: "/media/cards/card-1",
        storagePath: "anime/current.webp",
      }],
      turnEndsAt: deadline,
    };
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          ...round,
          democracyVotes: [{
            participantId: "participant-1",
            cardId: "card-1",
            tier: "B",
            hasntTried: false,
          }],
        })),
      },
    };
    const database = {
      round: { findUnique: vi.fn(async () => round) },
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const timers = { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService;
    const service = new RoundService(
      database,
      { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus,
      timers,
    );

    await service.handleRosterChanged("round-1");

    expect(timers.schedule).toHaveBeenCalledWith(
      "turn:round-1",
      deadline,
      expect.any(Function),
    );
  });

  it("lets only the party leader end an active game", async () => {
    const roundUpdate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          sessionId: "session-1",
          status: "PLAYING",
          session: { leaderParticipantId: "participant-1" },
        })),
        update: roundUpdate,
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-1", active: true })),
      },
      chaosClaim: { deleteMany: vi.fn(async () => undefined) },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const timers = { cancel: vi.fn(), schedule: vi.fn() } as unknown as TimerSchedulerService;
    const events = { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus;
    const service = new RoundService(database, events, timers);

    await service.endGame({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-1",
    }, "round-1");

    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: expect.objectContaining({ status: "RESULTS", selectedCardId: null }),
    });
    expect(timers.cancel).toHaveBeenCalledWith("turn:round-1");
    expect(events.emit).toHaveBeenCalledWith("session-1");
  });

  it("atomically removes a claimed Chaos card from the visible bank", async () => {
    const bank = Array.from({ length: 6 }, (_, index) => ({
      id: `card-${index + 1}`,
      title: `Card ${index + 1}`,
      imageUrl: `/media/cards/card-${index + 1}`,
      storagePath: `anime/card-${index + 1}.webp`,
    }));
    const roundUpdate = vi.fn(async () => undefined);
    const claimCreate = vi.fn(async () => undefined);
    const transaction = {
      round: {
        findUnique: vi.fn(async () => ({
          id: "round-1",
          sessionId: "session-1",
          status: "PLAYING",
          gameMode: "CHAOS",
          playerQueue: ["participant-1", "participant-2"],
          cardQueue: bank,
        })),
        update: roundUpdate,
      },
      participant: {
        findUnique: vi.fn(async () => ({ id: "participant-1", active: true })),
      },
      chaosClaim: {
        findUnique: vi.fn(async () => null),
        create: claimCreate,
      },
      activitySession: { update: vi.fn(async () => undefined) },
    };
    const database = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const service = new RoundService(
      database,
      { emit: vi.fn(async () => undefined) } as unknown as SessionEventBus,
      {} as TimerSchedulerService,
    );

    await service.claimChaosCard({
      accessSessionId: "access-1",
      sessionId: "session-1",
      userId: "user-1",
    }, "round-1", "card-3");

    expect(claimCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: "card-3", participantId: "participant-1" }),
    });
    expect(roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: { cardQueue: bank.filter((card) => card.id !== "card-3") },
    });
  });
});
