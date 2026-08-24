import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaCard } from "../../shared/types/media.types.js";
import type { CardEndpoint } from "../../shared/types/round.types.js";
import { env } from "../config/env.js";
import { withSerializableTransaction } from "../infrastructure/transaction-retry.js";
import type { AuthContext } from "../models/auth-context.js";
import { AppError } from "../models/app-error.js";
import { isTier, rotateQueue } from "../models/game-rules.js";
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

export class RoundService {
  constructor(
    private readonly database: PrismaClient,
    private readonly events: SessionEventBus,
    private readonly timers: TimerSchedulerService,
  ) {}

  async beginRound(roundId: string): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({
        where: { id: roundId },
        include: { session: true },
      });
      if (!round || round.status !== "COUNTDOWN") return null;
      if (
        round.session.phase !== "COUNTDOWN" ||
        round.session.activeRoundId !== round.id ||
        (round.session.countdownEndsAt && round.session.countdownEndsAt > new Date())
      ) {
        return null;
      }
      const queue = ids(round.playerQueue);
      if (queue.length < env.minPlayers) {
        await transaction.round.update({
          where: { id: round.id },
          data: { status: "CANCELED", completedAt: new Date() },
        });
        await transaction.activitySession.update({
          where: { id: round.sessionId },
          data: {
            phase: "LOBBY",
            activeRoundId: null,
            countdownEndsAt: null,
            version: { increment: 1 },
          },
        });
        return { sessionId: round.sessionId, turnDeadline: null };
      }

      const turnDeadline = new Date(Date.now() + env.turnSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          status: "PLAYING",
          startedAt: new Date(),
          turnEndsAt: turnDeadline,
          currentEndpoint: "BANK",
          endpointSequence: 0,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: {
          phase: "PLAYING",
          countdownEndsAt: null,
          version: { increment: 1 },
        },
      });
      return { sessionId: round.sessionId, turnDeadline };
    });

    if (!result) return;
    if (result.turnDeadline) this.scheduleTurn(roundId, result.turnDeadline);
    await this.events.emit(result.sessionId);
  }

  async changeEndpoint(
    context: AuthContext,
    input: {
      roundId: string;
      turnNumber: number;
      cardId: string;
      from: CardEndpoint;
      to: CardEndpoint;
      sequence: number;
    },
  ): Promise<void> {
    await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: input.roundId } });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING") {
        throw new AppError(409, "ROUND_NOT_PLAYING", "The round is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      const queue = ids(round.playerQueue);
      const card = cards(round.cardQueue)[0];
      if (!participant?.active || queue[0] !== participant.id) {
        throw new AppError(403, "NOT_YOUR_TURN", "Only the current player can move the card");
      }
      if (!card || card.id !== input.cardId) {
        throw new AppError(409, "CARD_NOT_PLAYABLE", "Only the first bank card can be moved");
      }
      if (round.turnNumber !== input.turnNumber) {
        throw new AppError(409, "STALE_TURN", "That turn has already ended");
      }
      if (round.currentEndpoint !== input.from || input.sequence <= round.endpointSequence) {
        throw new AppError(409, "STALE_ENDPOINT", "That card movement is out of date");
      }

      await transaction.round.update({
        where: { id: round.id },
        data: { currentEndpoint: input.to, endpointSequence: input.sequence },
      });
      await transaction.activitySession.update({
        where: { id: context.sessionId },
        data: { version: { increment: 1 } },
      });
    });
    await this.events.emit(context.sessionId);
  }

  async endTurn(context: AuthContext, roundId: string): Promise<void> {
    await this.finishTurn({
      roundId,
      sessionId: context.sessionId,
      userId: context.userId,
      reason: "MANUAL",
    });
  }

  async handleTurnTimeout(roundId: string): Promise<void> {
    const round = await this.database.round.findUnique({ where: { id: roundId } });
    if (!round || round.status !== "PLAYING") return;
    if (round.turnEndsAt && round.turnEndsAt > new Date()) {
      this.scheduleTurn(round.id, round.turnEndsAt);
      return;
    }
    await this.finishTurn({
      roundId,
      sessionId: round.sessionId,
      reason: "TIMEOUT",
    });
  }

  private async finishTurn(input: {
    roundId: string;
    sessionId: string;
    userId?: string;
    reason: "MANUAL" | "TIMEOUT";
  }): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: input.roundId } });
      if (!round || round.sessionId !== input.sessionId || round.status !== "PLAYING") {
        if (input.reason === "TIMEOUT") return null;
        throw new AppError(409, "ROUND_NOT_PLAYING", "The round is not active");
      }
      if (round.turnEndsAt && round.turnEndsAt > new Date() && input.reason === "TIMEOUT") {
        return { sessionId: round.sessionId, nextTurn: round.turnEndsAt, results: null };
      }

      const queue = ids(round.playerQueue);
      const participantId = queue[0];
      if (!participantId) return null;
      if (input.userId) {
        const actor = await transaction.participant.findUnique({
          where: { sessionId_userId: { sessionId: input.sessionId, userId: input.userId } },
        });
        if (!actor?.active || actor.id !== participantId) {
          throw new AppError(403, "NOT_YOUR_TURN", "Only the current player can end the turn");
        }
      }

      const endpoint = round.currentEndpoint as CardEndpoint;
      if (input.reason === "MANUAL" && !isTier(endpoint)) {
        throw new AppError(409, "CARD_NOT_PLACED", "Place the card in a tier before ending your turn");
      }

      const bank = cards(round.cardQueue);
      const activeCard = bank[0] ?? null;
      const shouldCommit = Boolean(activeCard && isTier(endpoint));
      const nextBank = shouldCommit ? bank.slice(1) : bank;

      if (activeCard && shouldCommit && isTier(endpoint)) {
        const sortIndex = await transaction.placement.count({
          where: { roundId: round.id, tier: endpoint },
        });
        await transaction.placement.create({
          data: {
            roundId: round.id,
            participantId,
            cardId: activeCard.id,
            title: activeCard.title,
            imageUrl: activeCard.imageUrl,
            storagePath: activeCard.storagePath,
            tier: endpoint,
            sortIndex,
          },
        });
      }

      await transaction.turn.create({
        data: {
          roundId: round.id,
          participantId,
          turnNumber: round.turnNumber,
          cardId: activeCard?.id,
          finalTier: isTier(endpoint) ? endpoint : null,
          startedAt: new Date(
            (round.turnEndsAt?.getTime() ?? Date.now()) - env.turnSeconds * 1_000,
          ),
          endedAt: new Date(),
          endedReason: input.reason,
        },
      });

      if (nextBank.length === 0) {
        const resultsDeadline = new Date(Date.now() + env.resultsSeconds * 1_000);
        await transaction.round.update({
          where: { id: round.id },
          data: {
            status: "RESULTS",
            cardQueue: asJson(nextBank),
            currentEndpoint: "BANK",
            turnEndsAt: null,
            resultsEndsAt: resultsDeadline,
            turnNumber: { increment: 1 },
          },
        });
        await transaction.activitySession.update({
          where: { id: round.sessionId },
          data: {
            phase: "RESULTS",
            resultsEndsAt: resultsDeadline,
            version: { increment: 1 },
          },
        });
        return { sessionId: round.sessionId, nextTurn: null, results: resultsDeadline };
      }

      const nextQueue = rotateQueue(queue);
      const turnDeadline = new Date(Date.now() + env.turnSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          playerQueue: asJson(nextQueue),
          cardQueue: asJson(nextBank),
          currentEndpoint: "BANK",
          endpointSequence: 0,
          turnNumber: { increment: 1 },
          turnEndsAt: turnDeadline,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return { sessionId: round.sessionId, nextTurn: turnDeadline, results: null };
    });

    if (!result) return;
    this.timers.cancel(`turn:${input.roundId}`);
    if (result.results) this.scheduleResults(input.roundId, result.results);
    else if (result.nextTurn) this.scheduleTurn(input.roundId, result.nextTurn);
    await this.events.emit(result.sessionId);
  }

  async finishResults(roundId: string): Promise<void> {
    const sessionId = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({
        where: { id: roundId },
        include: { session: true },
      });
      if (!round || round.status !== "RESULTS") return null;
      if (round.resultsEndsAt && round.resultsEndsAt > new Date()) {
        this.scheduleResults(round.id, round.resultsEndsAt);
        return null;
      }
      await transaction.round.update({
        where: { id: round.id },
        data: { status: "COMPLETE", completedAt: new Date() },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: {
          phase: "LOBBY",
          activeRoundId: null,
          resultsEndsAt: null,
          version: { increment: 1 },
        },
      });
      return round.sessionId;
    });
    if (sessionId) await this.events.emit(sessionId);
  }

  async restoreTimers(): Promise<void> {
    const sessions = await this.database.activitySession.findMany({
      where: { phase: { in: ["COUNTDOWN", "PLAYING", "RESULTS"] } },
    });
    for (const session of sessions) {
      if (!session.activeRoundId) continue;
      if (session.phase === "COUNTDOWN" && session.countdownEndsAt) {
        this.timers.schedule(`countdown:${session.activeRoundId}`, session.countdownEndsAt, () =>
          this.beginRound(session.activeRoundId as string),
        );
      } else {
        const round = await this.database.round.findUnique({
          where: { id: session.activeRoundId },
        });
        if (round?.status === "PLAYING" && round.turnEndsAt) {
          this.scheduleTurn(round.id, round.turnEndsAt);
        } else if (round?.status === "RESULTS" && round.resultsEndsAt) {
          this.scheduleResults(round.id, round.resultsEndsAt);
        }
      }
    }
  }

  private scheduleTurn(roundId: string, deadline: Date): void {
    this.timers.schedule(`turn:${roundId}`, deadline, () => this.handleTurnTimeout(roundId));
  }

  private scheduleResults(roundId: string, deadline: Date): void {
    this.timers.schedule(`results:${roundId}`, deadline, () => this.finishResults(roundId));
  }
}
