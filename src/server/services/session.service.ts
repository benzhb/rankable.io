import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuthContext } from "../models/auth-context.js";
import type { MediaCatalog, MediaCard } from "../../shared/types/media.types.js";
import type { GameMode } from "../../shared/types/round.types.js";
import { env } from "../config/env.js";
import { withSerializableTransaction } from "../infrastructure/transaction-retry.js";
import { AppError } from "../models/app-error.js";
import { removeFromQueue, shuffle } from "../models/game-rules.js";
import { SessionEventBus } from "./session-event-bus.js";
import { TimerSchedulerService } from "./timer-scheduler.service.js";

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function cards(value: unknown): MediaCard[] {
  return Array.isArray(value) ? (value as MediaCard[]) : [];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class SessionService {
  private beginRoundHandler: ((roundId: string) => Promise<void>) | null = null;
  private turnTimeoutHandler: ((roundId: string) => Promise<void>) | null = null;
  private rosterChangedHandler: ((roundId: string) => Promise<void>) | null = null;

  constructor(
    private readonly database: PrismaClient,
    private readonly events: SessionEventBus,
    private readonly timers: TimerSchedulerService,
  ) {}

  setBeginRoundHandler(handler: (roundId: string) => Promise<void>): void {
    this.beginRoundHandler = handler;
  }

  setTurnTimeoutHandler(handler: (roundId: string) => Promise<void>): void {
    this.turnTimeoutHandler = handler;
  }

  setRosterChangedHandler(handler: (roundId: string) => Promise<void>): void {
    this.rosterChangedHandler = handler;
  }

  async join(context: AuthContext): Promise<void> {
    let canceledRoundId: string | null = null;
    await withSerializableTransaction(this.database, async (transaction) => {
      canceledRoundId = null;
      const session = await transaction.activitySession.findUnique({
        where: { id: context.sessionId },
      });
      if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Activity session not found");
      if (session.phase === "PLAYING" || session.phase === "RESULTS" || session.phase === "ENDED") {
        throw new AppError(409, "LOBBY_NOT_JOINABLE", "The lobby cannot be joined right now");
      }

      const existing = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: session.id, userId: context.userId } },
      });
      if (existing?.active) return;

      if (session.phase === "COUNTDOWN" && session.activeRoundId) {
        canceledRoundId = session.activeRoundId;
        await transaction.round.update({
          where: { id: session.activeRoundId },
          data: { status: "CANCELED", completedAt: new Date() },
        });
      }

      const participant = existing
        ? await transaction.participant.update({
            where: { id: existing.id },
            data: {
              active: true,
              joinOrder: session.nextJoinOrder,
              joinedAt: new Date(),
              leftAt: null,
              lastSeenAt: new Date(),
            },
          })
        : await transaction.participant.create({
            data: {
              sessionId: session.id,
              userId: context.userId,
              joinOrder: session.nextJoinOrder,
            },
          });

      await transaction.activitySession.update({
        where: { id: session.id },
        data: {
          phase: session.phase === "COUNTDOWN" ? "LOBBY" : session.phase,
          activeRoundId: session.phase === "COUNTDOWN" ? null : session.activeRoundId,
          countdownEndsAt: session.phase === "COUNTDOWN" ? null : session.countdownEndsAt,
          leaderParticipantId: session.leaderParticipantId ?? participant.id,
          nextJoinOrder: { increment: 1 },
          version: { increment: 1 },
        },
      });
    });

    if (canceledRoundId) this.timers.cancel(`countdown:${canceledRoundId}`);
    await this.events.emit(context.sessionId);
  }

  async leave(context: AuthContext, reason: "MANUAL" | "DISCONNECTED" = "MANUAL"): Promise<void> {
    let canceledRoundId: string | null = null;
    let nextTurn: { roundId: string; deadline: Date } | null = null;
    let rosterChangedRoundId: string | null = null;

    await withSerializableTransaction(this.database, async (transaction) => {
      canceledRoundId = null;
      nextTurn = null;
      rosterChangedRoundId = null;
      const session = await transaction.activitySession.findUnique({
        where: { id: context.sessionId },
      });
      if (!session) return;
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: session.id, userId: context.userId } },
      });
      if (!participant?.active) return;

      await transaction.participant.update({
        where: { id: participant.id },
        data: { active: false, leftAt: new Date(), lastSeenAt: new Date() },
      });

      let phase = session.phase;
      let activeRoundId = session.activeRoundId;
      let countdownEndsAt = session.countdownEndsAt;

      if (session.activeRoundId && (session.phase === "COUNTDOWN" || session.phase === "PLAYING")) {
        const round = await transaction.round.findUnique({ where: { id: session.activeRoundId } });
        if (round) {
          const queue = ids(round.playerQueue);
          const wasCurrent = queue[0] === participant.id;
          const nextQueue = removeFromQueue(queue, participant.id);
          await transaction.roundParticipant.updateMany({
            where: { roundId: round.id, participantId: participant.id },
            data: { active: false, removedAt: new Date() },
          });
          if (round.gameMode === "DEMOCRACY" && round.selectedCardId) {
            await transaction.democracyVote.deleteMany({
              where: {
                roundId: round.id,
                cardId: round.selectedCardId,
                participantId: participant.id,
              },
            });
          }

          if (session.phase === "COUNTDOWN") {
            if (nextQueue.length < env.minPlayers) {
              canceledRoundId = round.id;
              phase = "LOBBY";
              activeRoundId = null;
              countdownEndsAt = null;
              await transaction.round.update({
                where: { id: round.id },
                data: { status: "CANCELED", playerQueue: asJson(nextQueue), completedAt: new Date() },
              });
            } else {
              await transaction.round.update({
                where: { id: round.id },
                data: { playerQueue: asJson(nextQueue) },
              });
            }
          } else if (session.phase === "PLAYING") {
            rosterChangedRoundId = round.id;
            if (round.gameMode === "PRESENTATION" && wasCurrent) {
              await transaction.turn.create({
                data: {
                  roundId: round.id,
                  participantId: participant.id,
                  turnNumber: round.turnNumber,
                  cardId: round.selectedCardId,
                  startedAt: new Date(
                    (round.turnEndsAt?.getTime() ?? Date.now()) - env.turnSeconds * 1_000,
                  ),
                  endedAt: new Date(),
                  endedReason: "DISCONNECTED",
                },
              });
            }
            if (nextQueue.length === 0) {
              canceledRoundId = round.id;
              phase = "LOBBY";
              activeRoundId = null;
              if (round.gameMode === "CHAOS") {
                await transaction.chaosClaim.deleteMany({ where: { roundId: round.id } });
              }
              await transaction.round.update({
                where: { id: round.id },
                data: {
                  status: "CANCELED",
                  playerQueue: asJson(nextQueue),
                  selectedCardId: null,
                  currentEndpoint: "BANK",
                  turnEndsAt: null,
                  completedAt: new Date(),
                },
              });
            } else {
              let nextCardQueue = cards(round.cardQueue);
              if (round.gameMode === "CHAOS") {
                const claims = await transaction.chaosClaim.findMany({
                  where: { roundId: round.id, participantId: participant.id },
                });
                if (claims.length > 0) {
                  nextCardQueue = [
                    ...claims.map((claim) => ({
                      id: claim.cardId,
                      title: claim.title,
                      imageUrl: claim.imageUrl,
                      storagePath: claim.storagePath,
                    })),
                    ...nextCardQueue,
                  ];
                  await transaction.chaosClaim.deleteMany({
                    where: { roundId: round.id, participantId: participant.id },
                  });
                }
              }
              const advancesTurn = round.gameMode === "PRESENTATION" && wasCurrent;
              const deadline = advancesTurn
                ? new Date(Date.now() + env.turnSeconds * 1_000)
                : round.turnEndsAt;
              await transaction.round.update({
                where: { id: round.id },
                data: {
                  playerQueue: asJson(nextQueue),
                  cardQueue: asJson(nextCardQueue),
                  selectedCardId: advancesTurn ? null : round.selectedCardId,
                  passParticipantIds: asJson(
                    ids(round.passParticipantIds).filter((id) => id !== participant.id),
                  ),
                  currentEndpoint: advancesTurn ? "BANK" : round.currentEndpoint,
                  endpointSequence: advancesTurn ? 0 : round.endpointSequence,
                  turnNumber: advancesTurn ? { increment: 1 } : round.turnNumber,
                  turnEndsAt: deadline,
                },
              });
              if (advancesTurn && deadline) nextTurn = { roundId: round.id, deadline };
            }
          }
        }
      }

      const replacement = await transaction.participant.findFirst({
        where: { sessionId: session.id, active: true },
        orderBy: { joinOrder: "asc" },
      });
      const leaderParticipantId =
        session.leaderParticipantId === participant.id
          ? replacement?.id ?? null
          : session.leaderParticipantId;

      await transaction.activitySession.update({
        where: { id: session.id },
        data: {
          phase,
          activeRoundId,
          countdownEndsAt,
          leaderParticipantId,
          version: { increment: 1 },
        },
      });
    });

    if (canceledRoundId) {
      this.timers.cancel(`countdown:${canceledRoundId}`);
      this.timers.cancel(`turn:${canceledRoundId}`);
    }
    const scheduledTurn = nextTurn as { roundId: string; deadline: Date } | null;
    if (scheduledTurn) {
      this.timers.schedule(`turn:${scheduledTurn.roundId}`, scheduledTurn.deadline, async () => {
        await this.turnTimeoutHandler?.(scheduledTurn.roundId);
      });
    }
    const changedRound = rosterChangedRoundId as string | null;
    if (changedRound && changedRound !== canceledRoundId) {
      await this.rosterChangedHandler?.(changedRound);
    }
    await this.events.emit(context.sessionId);
    void reason;
  }

  async startCountdown(
    context: AuthContext,
    categoryKey: string,
    gameMode: GameMode,
  ): Promise<string> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const session = await transaction.activitySession.findUnique({
        where: { id: context.sessionId },
        include: {
          mediaCatalog: true,
          participants: { where: { active: true }, orderBy: { joinOrder: "asc" } },
        },
      });
      if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Activity session not found");
      const actor = session.participants.find((participant) => participant.userId === context.userId);
      if (!actor || actor.id !== session.leaderParticipantId) {
        throw new AppError(403, "LEADER_REQUIRED", "Only the party leader can start the game");
      }
      if (session.phase !== "LOBBY") {
        throw new AppError(409, "INVALID_SESSION_PHASE", "The lobby is not ready to start");
      }
      if (session.participants.length < env.minPlayers) {
        throw new AppError(409, "NOT_ENOUGH_PLAYERS", `At least ${env.minPlayers} players are required`);
      }

      const catalog = session.mediaCatalog?.data as unknown as MediaCatalog | undefined;
      const category = catalog?.categories.find((candidate) => candidate.key === categoryKey);
      if (!category) throw new AppError(400, "UNKNOWN_CATEGORY", "That category is unavailable");
      if (category.cards.length === 0) throw new AppError(409, "EMPTY_CATEGORY", "That category has no cards");

      const playerQueue = shuffle(session.participants.map((participant) => participant.id));
      const cardQueue = shuffle(category.cards).slice(0, env.roundCardLimit);
      const deadline = new Date(Date.now() + env.countdownSeconds * 1_000);
      const round = await transaction.round.create({
        data: {
          sessionId: session.id,
          categoryKey,
          gameMode,
          playerQueue: asJson(playerQueue),
          cardQueue: asJson(cardQueue),
          players: {
            create: playerQueue.map((participantId, initialQueuePosition) => ({
              participantId,
              initialQueuePosition,
            })),
          },
        },
      });
      await transaction.activitySession.update({
        where: { id: session.id },
        data: {
          phase: "COUNTDOWN",
          selectedCategoryKey: categoryKey,
          selectedGameMode: gameMode,
          activeRoundId: round.id,
          countdownEndsAt: deadline,
          resultsEndsAt: null,
          version: { increment: 1 },
        },
      });
      return { roundId: round.id, deadline };
    });

    this.timers.schedule(`countdown:${result.roundId}`, result.deadline, async () => {
      await this.beginRoundHandler?.(result.roundId);
    });
    await this.events.emit(context.sessionId);
    return result.roundId;
  }

  async cancelCountdown(context: AuthContext): Promise<void> {
    const roundId = await withSerializableTransaction(this.database, async (transaction) => {
      const session = await transaction.activitySession.findUnique({
        where: { id: context.sessionId },
        include: { participants: { where: { active: true } } },
      });
      if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Activity session not found");
      const actor = session.participants.find((participant) => participant.userId === context.userId);
      if (!actor || actor.id !== session.leaderParticipantId) {
        throw new AppError(403, "LEADER_REQUIRED", "Only the party leader can stop the countdown");
      }
      if (session.phase !== "COUNTDOWN" || !session.activeRoundId) {
        throw new AppError(409, "NO_COUNTDOWN", "There is no active countdown");
      }
      await transaction.round.update({
        where: { id: session.activeRoundId },
        data: { status: "CANCELED", completedAt: new Date() },
      });
      await transaction.activitySession.update({
        where: { id: session.id },
        data: {
          phase: "LOBBY",
          activeRoundId: null,
          countdownEndsAt: null,
          version: { increment: 1 },
        },
      });
      return session.activeRoundId;
    });

    this.timers.cancel(`countdown:${roundId}`);
    await this.events.emit(context.sessionId);
  }
}
