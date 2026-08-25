import type { PrismaClient } from "../../generated/prisma/client.js";
import type { MediaCatalog, MediaCard } from "../../shared/types/media.types.js";
import type { CardEndpoint, PlacementSnapshot, QueuedPlayerSnapshot, RoundSnapshot } from "../../shared/types/round.types.js";
import type { SessionSnapshot } from "../../shared/types/session.types.js";
import { visibleCardWindow } from "../models/game-rules.js";
import { AppError } from "../models/app-error.js";

function cards(value: unknown): MediaCard[] {
  return Array.isArray(value) ? (value as MediaCard[]) : [];
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clientCard(card: MediaCard): MediaCard {
  return {
    ...card,
    imageUrl: card.imageUrl.startsWith("data:")
      ? card.imageUrl
      : `/media/cards/${encodeURIComponent(card.id)}`,
  };
}

export class SnapshotService {
  constructor(private readonly database: PrismaClient) {}

  async get(sessionId: string, userId: string): Promise<SessionSnapshot> {
    const session = await this.database.activitySession.findUnique({
      where: { id: sessionId },
      include: {
        mediaCatalog: true,
        participants: {
          where: { active: true },
          orderBy: { joinOrder: "asc" },
          include: { user: true },
        },
      },
    });
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Activity session not found");

    const selfParticipant = session.participants.find((member) => member.userId === userId) ?? null;
    const isLeader = selfParticipant?.id === session.leaderParticipantId;
    const catalog = session.mediaCatalog?.data as unknown as MediaCatalog | undefined;

    let roundSnapshot: RoundSnapshot | null = null;
    if (session.activeRoundId) {
      const round = await this.database.round.findUnique({
        where: { id: session.activeRoundId },
        include: {
          players: { include: { participant: { include: { user: true } } } },
          placements: { orderBy: [{ tier: "asc" }, { sortIndex: "asc" }] },
          democracyVotes: { include: { participant: { include: { user: true } } } },
          chaosClaims: { include: { participant: { include: { user: true } } } },
        },
      });
      if (round && ["COUNTDOWN", "PLAYING", "RESULTS"].includes(round.status)) {
        const queueIds = ids(round.playerQueue);
        const playerMap = new Map(
          round.players.map((player) => [player.participantId, player.participant]),
        );
        const playerQueue: QueuedPlayerSnapshot[] = queueIds.flatMap((participantId, index) => {
          const participant = playerMap.get(participantId);
          if (!participant) return [];
          return [{
            participantId,
            username: participant.user.username,
            avatarUrl: participant.user.avatarUrl,
            isCurrent:
              index === 0 &&
              round.status === "PLAYING" &&
              round.gameMode === "PRESENTATION",
            isSelf: participant.userId === userId,
          }];
        });
        const cardQueue = cards(round.cardQueue);
        const placements: PlacementSnapshot[] = round.placements.map((placement) => ({
          id: placement.cardId,
          title: placement.title,
          imageUrl: placement.imageUrl.startsWith("data:")
            ? placement.imageUrl
            : `/media/cards/${encodeURIComponent(placement.cardId)}`,
          storagePath: placement.storagePath,
          participantId: placement.participantId,
          tier: placement.tier,
          sortIndex: placement.sortIndex,
        }) as PlacementSnapshot);

        roundSnapshot = {
          id: round.id,
          status: round.status as RoundSnapshot["status"],
          categoryKey: round.categoryKey,
          gameMode: round.gameMode,
          playerQueue,
          currentPlayerId:
            round.status === "PLAYING" && round.gameMode === "PRESENTATION"
              ? queueIds[0] ?? null
              : null,
          selectedCardId: round.selectedCardId,
          currentEndpoint: round.currentEndpoint as CardEndpoint,
          endpointSequence: round.endpointSequence,
          turnNumber: round.turnNumber,
          turnEndsAt: round.turnEndsAt?.toISOString() ?? null,
          resultsEndsAt: round.resultsEndsAt?.toISOString() ?? null,
          lastSkippedCard:
            round.lastSkippedCardTitle && round.lastSkippedAt
              ? {
                  title: round.lastSkippedCardTitle,
                  count: round.lastSkippedCardCount ?? 1,
                  skippedAt: round.lastSkippedAt.toISOString(),
                }
              : null,
          cardBank: {
            remainingCount: cardQueue.length,
            visibleCards: visibleCardWindow(cardQueue).map(clientCard),
          },
          placements,
          democracy:
            round.gameMode === "DEMOCRACY"
              ? {
                  phase:
                    round.status === "PLAYING" && !round.selectedCardId
                      ? "REVEAL"
                      : "VOTING",
                  revealEndsAt:
                    round.status === "PLAYING" && !round.selectedCardId
                      ? round.turnEndsAt?.toISOString() ?? null
                      : null,
                  lastResolvedCardId: round.lastResolvedCardId,
                  eligibleVoterCount: queueIds.length,
                  votes: round.democracyVotes
                    .filter(
                      (vote) =>
                        vote.cardId === round.selectedCardId &&
                        queueIds.includes(vote.participantId),
                    )
                    .map((vote) => ({
                      participantId: vote.participantId,
                      username: vote.participant.user.username,
                      avatarUrl: vote.participant.user.avatarUrl,
                      choice: vote.hasntTried ? "HAVENT_TRIED" : vote.tier!,
                      isSelf: vote.participant.userId === userId,
                    })),
                }
              : null,
          chaos:
            round.gameMode === "CHAOS"
              ? {
                  claims: round.chaosClaims.map((claim) => ({
                    id: claim.cardId,
                    title: claim.title,
                    imageUrl: claim.imageUrl.startsWith("data:")
                      ? claim.imageUrl
                      : `/media/cards/${encodeURIComponent(claim.cardId)}`,
                    storagePath: claim.storagePath,
                    participantId: claim.participantId,
                    username: claim.participant.user.username,
                    isSelf: claim.participant.userId === userId,
                  })),
                }
              : null,
        };
      }
    }

    const isCurrentPlayer =
      roundSnapshot?.status === "PLAYING" &&
      roundSnapshot.gameMode === "PRESENTATION" &&
      roundSnapshot.currentPlayerId === selfParticipant?.id;

    return {
      sessionId: session.id,
      version: session.version,
      serverTime: new Date().toISOString(),
      phase: session.phase,
      self: {
        userId,
        participantId: selfParticipant?.id ?? null,
        membership: selfParticipant ? "JOINED" : "VIEWING",
        isLeader,
      },
      capabilities: {
        canJoin:
          !selfParticipant && (session.phase === "LOBBY" || session.phase === "COUNTDOWN"),
        canLeave: Boolean(selfParticipant) && session.phase !== "ENDED",
        canSelectCategory: Boolean(isLeader) && session.phase === "LOBBY",
        canSelectGameMode: Boolean(isLeader) && session.phase === "LOBBY",
        canStartCountdown: Boolean(isLeader) && session.phase === "LOBBY",
        canCancelCountdown: Boolean(isLeader) && session.phase === "COUNTDOWN",
        canEndTurn: Boolean(isCurrentPlayer),
        canEndGame: Boolean(isLeader) && session.phase === "PLAYING",
      },
      members: session.participants.map((participant) => ({
        participantId: participant.id,
        discordUserId: participant.userId,
        username: participant.user.username,
        avatarUrl: participant.user.avatarUrl,
        isLeader: participant.id === session.leaderParticipantId,
        isSelf: participant.userId === userId,
      })),
      categories: (catalog?.categories ?? []).map((category) => ({
        key: category.key,
        label: category.label,
        cardCount: category.cards.length,
      })),
      selectedCategoryKey: session.selectedCategoryKey,
      selectedGameMode: session.selectedGameMode,
      countdownEndsAt: session.countdownEndsAt?.toISOString() ?? null,
      round: roundSnapshot,
    };
  }
}
