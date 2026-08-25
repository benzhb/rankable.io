import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaCard } from "../../shared/types/media.types.js";
import type { CardEndpoint, DemocracyChoice, Tier } from "../../shared/types/round.types.js";
import { env } from "../config/env.js";
import { withSerializableTransaction } from "../infrastructure/transaction-retry.js";
import type { AuthContext } from "../models/auth-context.js";
import { AppError } from "../models/app-error.js";
import {
  isTier,
  lowerMedianTier,
  rotateQueue,
  visibleCardWindow,
} from "../models/game-rules.js";
import { SessionEventBus } from "./session-event-bus.js";
import { TimerSchedulerService } from "./timer-scheduler.service.js";

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function cards(value: unknown): MediaCard[] {
  return Array.isArray(value) ? (value as MediaCard[]) : [];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

interface TimedAdvance {
  sessionId: string;
  nextDeadline: Date | null;
  resultsDeadline: Date | null;
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
      ) return null;

      const queue = ids(round.playerQueue);
      const bank = cards(round.cardQueue);
      if (queue.length < env.minPlayers || bank.length === 0) {
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
        return { sessionId: round.sessionId, deadline: null };
      }

      const deadline = round.gameMode === "CHAOS"
        ? null
        : new Date(Date.now() + env.turnSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          status: "PLAYING",
          startedAt: new Date(),
          turnEndsAt: deadline,
          selectedCardId: round.gameMode === "DEMOCRACY" ? bank[0]!.id : null,
          lastResolvedCardId: null,
          passParticipantIds: asJson([]),
          currentEndpoint: "BANK",
          endpointSequence: 0,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { phase: "PLAYING", countdownEndsAt: null, version: { increment: 1 } },
      });
      return { sessionId: round.sessionId, deadline };
    });

    if (!result) return;
    if (result.deadline) this.scheduleTurn(roundId, result.deadline);
    await this.events.emit(result.sessionId);
  }

  async selectPresentationCard(
    context: AuthContext,
    input: { roundId: string; turnNumber: number; cardId: string },
  ): Promise<string> {
    const participantId = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: input.roundId } });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING" || round.gameMode !== "PRESENTATION") {
        throw new AppError(409, "PRESENTATION_NOT_ACTIVE", "Presentation mode is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      const queue = ids(round.playerQueue);
      if (!participant?.active || queue[0] !== participant.id) {
        throw new AppError(403, "NOT_YOUR_TURN", "Only the current player can choose a card");
      }
      if (round.turnNumber !== input.turnNumber) {
        throw new AppError(409, "STALE_TURN", "That turn has already ended");
      }
      if (!visibleCardWindow(cards(round.cardQueue)).some((card) => card.id === input.cardId)) {
        throw new AppError(409, "CARD_NOT_PLAYABLE", "Choose one of the five visible cards");
      }
      if (round.currentEndpoint !== "BANK" && round.selectedCardId !== input.cardId) {
        throw new AppError(409, "CARD_ALREADY_IN_PLAY", "Return the current card before choosing another");
      }

      const changingCard = round.selectedCardId !== input.cardId;
      await transaction.round.update({
        where: { id: round.id },
        data: {
          selectedCardId: input.cardId,
          currentEndpoint: changingCard ? "BANK" : round.currentEndpoint,
          endpointSequence: changingCard ? 0 : round.endpointSequence,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return participant.id;
    });
    await this.events.emit(context.sessionId);
    return participantId;
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
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING" || round.gameMode !== "PRESENTATION") {
        throw new AppError(409, "ROUND_NOT_PLAYING", "Presentation mode is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      const queue = ids(round.playerQueue);
      if (!participant?.active || queue[0] !== participant.id) {
        throw new AppError(403, "NOT_YOUR_TURN", "Only the current player can move the card");
      }
      if (!round.selectedCardId || round.selectedCardId !== input.cardId) {
        throw new AppError(409, "CARD_NOT_PLAYABLE", "Choose a visible card before moving it");
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
    await this.finishPresentationTurn({
      roundId,
      sessionId: context.sessionId,
      userId: context.userId,
      reason: "MANUAL",
    });
  }

  async endGame(context: AuthContext, roundId: string): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({
        where: { id: roundId },
        include: { session: true },
      });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING") {
        throw new AppError(409, "ROUND_NOT_PLAYING", "There is no active game to end");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      if (!participant?.active || round.session.leaderParticipantId !== participant.id) {
        throw new AppError(403, "LEADER_REQUIRED", "Only the party leader can end the game");
      }

      await transaction.chaosClaim.deleteMany({ where: { roundId } });
      return this.enterResults(transaction, round.id, round.sessionId);
    });

    this.timers.cancel(`turn:${roundId}`);
    this.scheduleResults(roundId, result.resultsDeadline!);
    await this.events.emit(result.sessionId);
  }

  async castDemocracyVote(context: AuthContext, roundId: string, choice: DemocracyChoice): Promise<void> {
    await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: roundId } });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING" || round.gameMode !== "DEMOCRACY" || !round.selectedCardId) {
        throw new AppError(409, "DEMOCRACY_NOT_ACTIVE", "Democracy voting is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      if (!participant?.active || !ids(round.playerQueue).includes(participant.id)) {
        throw new AppError(403, "PLAYER_REQUIRED", "Only active players can vote");
      }
      const existing = await transaction.democracyVote.findUnique({
        where: {
          roundId_cardId_participantId: {
            roundId,
            cardId: round.selectedCardId,
            participantId: participant.id,
          },
        },
      });
      if (existing) throw new AppError(409, "ALREADY_VOTED", "Your vote is already locked in");

      await transaction.democracyVote.create({
        data: {
          roundId,
          participantId: participant.id,
          cardId: round.selectedCardId,
          tier: choice === "HAVENT_TRIED" ? null : choice,
          hasntTried: choice === "HAVENT_TRIED",
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
    });
    await this.events.emit(context.sessionId);
    await this.resolveDemocracyCard(roundId, false);
  }

  async claimChaosCard(context: AuthContext, roundId: string, cardId: string): Promise<void> {
    await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: roundId } });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING" || round.gameMode !== "CHAOS") {
        throw new AppError(409, "CHAOS_NOT_ACTIVE", "Chaos mode is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      if (!participant?.active || !ids(round.playerQueue).includes(participant.id)) {
        throw new AppError(403, "PLAYER_REQUIRED", "Only active players can claim cards");
      }
      const existingClaim = await transaction.chaosClaim.findUnique({
        where: { roundId_participantId: { roundId, participantId: participant.id } },
      });
      if (existingClaim) throw new AppError(409, "CARD_ALREADY_HELD", "Place your current card first");

      const bank = cards(round.cardQueue);
      const card = visibleCardWindow(bank).find((candidate) => candidate.id === cardId);
      if (!card) throw new AppError(409, "CARD_NOT_AVAILABLE", "That card is no longer available");

      await transaction.chaosClaim.create({
        data: {
          roundId,
          participantId: participant.id,
          cardId: card.id,
          title: card.title,
          imageUrl: card.imageUrl,
          storagePath: card.storagePath,
        },
      });
      await transaction.round.update({
        where: { id: round.id },
        data: { cardQueue: asJson(bank.filter((candidate) => candidate.id !== card.id)) },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
    });
    await this.events.emit(context.sessionId);
  }

  async placeChaosCard(context: AuthContext, roundId: string, cardId: string, tier: Tier): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: roundId } });
      if (!round || round.sessionId !== context.sessionId || round.status !== "PLAYING" || round.gameMode !== "CHAOS") {
        throw new AppError(409, "CHAOS_NOT_ACTIVE", "Chaos mode is not active");
      }
      const participant = await transaction.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      });
      const claim = await transaction.chaosClaim.findUnique({
        where: { roundId_cardId: { roundId, cardId } },
      });
      if (!participant?.active || !claim || claim.participantId !== participant.id) {
        throw new AppError(403, "CLAIM_REQUIRED", "You do not hold that card");
      }

      const sortIndex = await transaction.placement.count({ where: { roundId, tier } });
      await transaction.placement.create({
        data: {
          roundId,
          participantId: participant.id,
          cardId: claim.cardId,
          title: claim.title,
          imageUrl: claim.imageUrl,
          storagePath: claim.storagePath,
          tier,
          sortIndex,
        },
      });
      await transaction.chaosClaim.delete({ where: { id: claim.id } });
      const remainingClaims = await transaction.chaosClaim.count({ where: { roundId } });
      if (cards(round.cardQueue).length === 0 && remainingClaims === 0) {
        return this.enterResults(transaction, round.id, round.sessionId);
      }
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return { sessionId: round.sessionId, nextDeadline: null, resultsDeadline: null };
    });
    if (result.resultsDeadline) this.scheduleResults(roundId, result.resultsDeadline);
    await this.events.emit(result.sessionId);
  }

  async participantForEmote(context: AuthContext, roundId: string): Promise<string> {
    const [round, participant] = await Promise.all([
      this.database.round.findUnique({ where: { id: roundId } }),
      this.database.participant.findUnique({
        where: { sessionId_userId: { sessionId: context.sessionId, userId: context.userId } },
      }),
    ]);
    if (!round || round.sessionId !== context.sessionId || !["PLAYING", "RESULTS"].includes(round.status)) {
      throw new AppError(409, "ROUND_NOT_ACTIVE", "Emotes are only available during a round");
    }
    if (!participant?.active || !ids(round.playerQueue).includes(participant.id)) {
      throw new AppError(403, "PLAYER_REQUIRED", "Only active players can emote");
    }
    return participant.id;
  }

  async handleTurnTimeout(roundId: string): Promise<void> {
    const round = await this.database.round.findUnique({ where: { id: roundId } });
    if (!round || round.status !== "PLAYING" || round.gameMode === "CHAOS") return;
    if (round.turnEndsAt && round.turnEndsAt > new Date()) {
      this.scheduleTurn(round.id, round.turnEndsAt);
      return;
    }
    if (round.gameMode === "DEMOCRACY") {
      if (round.selectedCardId) await this.resolveDemocracyCard(round.id, true);
      else await this.finishDemocracyReveal(round.id);
      return;
    }
    await this.finishPresentationTurn({ roundId, sessionId: round.sessionId, reason: "TIMEOUT" });
  }

  async handleRosterChanged(roundId: string): Promise<void> {
    let round = await this.database.round.findUnique({ where: { id: roundId } });
    if (round?.status !== "PLAYING" || round.gameMode !== "DEMOCRACY") return;

    if (round.selectedCardId) await this.resolveDemocracyCard(round.id, false);

    round = await this.database.round.findUnique({ where: { id: roundId } });
    if (
      round?.status === "PLAYING" &&
      round.gameMode === "DEMOCRACY" &&
      round.turnEndsAt
    ) {
      this.scheduleTurn(round.id, round.turnEndsAt);
    }
  }

  private async finishPresentationTurn(input: {
    roundId: string;
    sessionId: string;
    userId?: string;
    reason: "MANUAL" | "TIMEOUT";
  }): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: input.roundId } });
      if (!round || round.sessionId !== input.sessionId || round.status !== "PLAYING" || round.gameMode !== "PRESENTATION") {
        if (input.reason === "TIMEOUT") return null;
        throw new AppError(409, "ROUND_NOT_PLAYING", "Presentation mode is not active");
      }
      if (round.turnEndsAt && round.turnEndsAt > new Date() && input.reason === "TIMEOUT") {
        return { sessionId: round.sessionId, nextDeadline: round.turnEndsAt, resultsDeadline: null };
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
      const bank = cards(round.cardQueue);
      const selectedCard = bank.find((card) => card.id === round.selectedCardId) ?? null;
      const shouldCommit = Boolean(selectedCard && isTier(endpoint));
      let nextBank = shouldCommit && selectedCard
        ? bank.filter((card) => card.id !== selectedCard.id)
        : bank;
      let nextPasses: string[] = [];
      let skippedCards: MediaCard[] = [];

      if (!shouldCommit) {
        nextPasses = [...new Set([...ids(round.passParticipantIds), participantId])];
        if (queue.every((queuedId) => nextPasses.includes(queuedId))) {
          skippedCards = visibleCardWindow(bank);
          const skippedIds = new Set(skippedCards.map((card) => card.id));
          nextBank = bank.filter((card) => !skippedIds.has(card.id));
          nextPasses = [];
        }
      }

      if (selectedCard && shouldCommit && isTier(endpoint)) {
        const sortIndex = await transaction.placement.count({ where: { roundId: round.id, tier: endpoint } });
        await transaction.placement.create({
          data: {
            roundId: round.id,
            participantId,
            cardId: selectedCard.id,
            title: selectedCard.title,
            imageUrl: selectedCard.imageUrl,
            storagePath: selectedCard.storagePath,
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
          cardId: selectedCard?.id,
          finalTier: shouldCommit && isTier(endpoint) ? endpoint : null,
          startedAt: new Date((round.turnEndsAt?.getTime() ?? Date.now()) - env.turnSeconds * 1_000),
          endedAt: new Date(),
          endedReason: input.reason,
        },
      });

      const skippedData = skippedCards.length > 0
        ? {
            lastSkippedCardTitle: skippedCards.length === 1 ? skippedCards[0]!.title : `${skippedCards.length} cards`,
            lastSkippedCardCount: skippedCards.length,
            lastSkippedAt: new Date(),
          }
        : {};

      if (nextBank.length === 0) {
        return this.enterResults(transaction, round.id, round.sessionId, {
          cardQueue: asJson(nextBank),
          turnNumber: { increment: 1 },
          ...skippedData,
        });
      }

      const nextQueue = rotateQueue(queue);
      const nextDeadline = new Date(Date.now() + env.turnSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          playerQueue: asJson(nextQueue),
          cardQueue: asJson(nextBank),
          selectedCardId: null,
          passParticipantIds: asJson(shouldCommit ? [] : nextPasses),
          currentEndpoint: "BANK",
          endpointSequence: 0,
          turnNumber: { increment: 1 },
          turnEndsAt: nextDeadline,
          ...skippedData,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return { sessionId: round.sessionId, nextDeadline, resultsDeadline: null };
    });

    if (!result) return;
    this.timers.cancel(`turn:${input.roundId}`);
    if (result.resultsDeadline) this.scheduleResults(input.roundId, result.resultsDeadline);
    else if (result.nextDeadline) this.scheduleTurn(input.roundId, result.nextDeadline);
    await this.events.emit(result.sessionId);
  }

  private async resolveDemocracyCard(roundId: string, force: boolean): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({
        where: { id: roundId },
        include: { democracyVotes: true },
      });
      if (!round || round.status !== "PLAYING" || round.gameMode !== "DEMOCRACY" || !round.selectedCardId) return null;
      if (force && round.turnEndsAt && round.turnEndsAt > new Date()) {
        return { sessionId: round.sessionId, nextDeadline: round.turnEndsAt, resultsDeadline: null, resolved: false };
      }

      const queue = ids(round.playerQueue);
      const queueSet = new Set(queue);
      const currentVotes = round.democracyVotes.filter(
        (vote) => vote.cardId === round.selectedCardId && queueSet.has(vote.participantId),
      );
      if (!force && currentVotes.length < queue.length) return null;

      const bank = cards(round.cardQueue);
      const card = bank.find((candidate) => candidate.id === round.selectedCardId);
      if (!card) return null;
      const tierVotes = currentVotes.flatMap((vote) => vote.tier ? [vote.tier as Tier] : []);
      const nextBank = bank.filter((candidate) => candidate.id !== card.id);

      if (tierVotes.length > 0) {
        const tier = lowerMedianTier(tierVotes);
        const sortIndex = await transaction.placement.count({ where: { roundId, tier } });
        await transaction.placement.create({
          data: {
            roundId,
            participantId: null,
            cardId: card.id,
            title: card.title,
            imageUrl: card.imageUrl,
            storagePath: card.storagePath,
            tier,
            sortIndex,
          },
        });
      }

      const skippedData = tierVotes.length === 0
        ? { lastSkippedCardTitle: card.title, lastSkippedCardCount: 1, lastSkippedAt: new Date() }
        : {};
      const nextDeadline = new Date(Date.now() + env.democracyRevealSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          cardQueue: asJson(nextBank),
          selectedCardId: null,
          lastResolvedCardId: card.id,
          turnNumber: { increment: 1 },
          turnEndsAt: nextDeadline,
          ...skippedData,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return { sessionId: round.sessionId, nextDeadline, resultsDeadline: null, resolved: true };
    });

    if (!result) return;
    if (!result.resolved) {
      if (result.nextDeadline) this.scheduleTurn(roundId, result.nextDeadline);
      return;
    }
    this.timers.cancel(`turn:${roundId}`);
    if (result.nextDeadline) this.scheduleTurn(roundId, result.nextDeadline);
    await this.events.emit(result.sessionId);
  }

  private async finishDemocracyReveal(roundId: string): Promise<void> {
    const result = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: roundId } });
      if (
        !round ||
        round.status !== "PLAYING" ||
        round.gameMode !== "DEMOCRACY" ||
        round.selectedCardId
      ) return null;
      if (round.turnEndsAt && round.turnEndsAt > new Date()) {
        return {
          sessionId: round.sessionId,
          nextDeadline: round.turnEndsAt,
          resultsDeadline: null,
          advanced: false,
        };
      }

      const bank = cards(round.cardQueue);
      if (bank.length === 0) {
        const entered = await this.enterResults(transaction, round.id, round.sessionId);
        return { ...entered, advanced: true };
      }

      const nextDeadline = new Date(Date.now() + env.turnSeconds * 1_000);
      await transaction.round.update({
        where: { id: round.id },
        data: {
          selectedCardId: bank[0]!.id,
          lastResolvedCardId: null,
          turnEndsAt: nextDeadline,
        },
      });
      await transaction.activitySession.update({
        where: { id: round.sessionId },
        data: { version: { increment: 1 } },
      });
      return {
        sessionId: round.sessionId,
        nextDeadline,
        resultsDeadline: null,
        advanced: true,
      };
    });

    if (!result) return;
    this.timers.cancel(`turn:${roundId}`);
    if (result.resultsDeadline) this.scheduleResults(roundId, result.resultsDeadline);
    else if (result.nextDeadline) this.scheduleTurn(roundId, result.nextDeadline);
    if (result.advanced) await this.events.emit(result.sessionId);
  }

  private async enterResults(
    transaction: Prisma.TransactionClient,
    roundId: string,
    sessionId: string,
    extraRoundData: Prisma.RoundUpdateInput = {},
  ): Promise<TimedAdvance> {
    const resultsDeadline = new Date(Date.now() + env.resultsSeconds * 1_000);
    await transaction.round.update({
      where: { id: roundId },
      data: {
        status: "RESULTS",
        selectedCardId: null,
        currentEndpoint: "BANK",
        turnEndsAt: null,
        resultsEndsAt: resultsDeadline,
        ...extraRoundData,
      },
    });
    await transaction.activitySession.update({
      where: { id: sessionId },
      data: { phase: "RESULTS", resultsEndsAt: resultsDeadline, version: { increment: 1 } },
    });
    return { sessionId, nextDeadline: null, resultsDeadline };
  }

  async finishResults(roundId: string): Promise<void> {
    const sessionId = await withSerializableTransaction(this.database, async (transaction) => {
      const round = await transaction.round.findUnique({ where: { id: roundId }, include: { session: true } });
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
        data: { phase: "LOBBY", activeRoundId: null, resultsEndsAt: null, version: { increment: 1 } },
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
        continue;
      }
      const round = await this.database.round.findUnique({
        where: { id: session.activeRoundId },
        include: { chaosClaims: true },
      });
      if (round?.status === "PLAYING" && round.gameMode === "CHAOS" && round.chaosClaims.length) {
        const released = round.chaosClaims.map((claim) => ({
          id: claim.cardId,
          title: claim.title,
          imageUrl: claim.imageUrl,
          storagePath: claim.storagePath,
        }));
        await withSerializableTransaction(this.database, async (transaction) => {
          await transaction.chaosClaim.deleteMany({ where: { roundId: round.id } });
          await transaction.round.update({
            where: { id: round.id },
            data: { cardQueue: asJson([...released, ...cards(round.cardQueue)]) },
          });
          await transaction.activitySession.update({
            where: { id: round.sessionId },
            data: { version: { increment: 1 } },
          });
        });
        await this.events.emit(round.sessionId);
      } else if (round?.status === "PLAYING" && round.turnEndsAt) {
        this.scheduleTurn(round.id, round.turnEndsAt);
      } else if (round?.status === "RESULTS" && round.resultsEndsAt) {
        this.scheduleResults(round.id, round.resultsEndsAt);
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
