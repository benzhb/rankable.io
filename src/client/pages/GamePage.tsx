import { useState, type DragEvent } from "react";
import type { MediaCard } from "../../shared/types/media.types.js";
import type { Tier } from "../../shared/types/round.types.js";
import { useDiscordActivity } from "../discord/DiscordProvider.js";
import { useServerTimer } from "../hooks/useServerTimer.js";
import { ActivityError } from "../components/shared/ActivityError.js";
import { CardBank } from "../components/game/CardBank.js";
import { DemocracyVoteModal } from "../components/game/DemocracyVoteModal.js";
import { EmoteMenu } from "../components/game/EmoteMenu.js";
import { PlayerQueue } from "../components/game/PlayerQueue.js";
import { PresentationDragGhost } from "../components/game/PresentationDragGhost.js";
import { ResultsOverlay } from "../components/game/ResultsOverlay.js";
import { SkipNotice } from "../components/game/SkipNotice.js";
import { TierList } from "../components/game/TierList.js";
import { SoundControls } from "../components/shared/SoundControls.js";

function pointerPosition(event: DragEvent<HTMLElement>): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, event.clientX / window.innerWidth)),
    y: Math.max(0, Math.min(1, event.clientY / window.innerHeight)),
  };
}

const MODE_LABELS = {
  PRESENTATION: "Presentation",
  DEMOCRACY: "Democracy",
  CHAOS: "Chaos",
} as const;

export function GamePage() {
  const activity = useDiscordActivity();
  const snapshot = activity.snapshot!;
  const round = snapshot.round;
  const [busyAction, setBusyAction] = useState(false);
  const remaining = useServerTimer(round?.turnEndsAt ?? null, snapshot.serverTime);

  if (!round) return null;
  const isPresentation = round.gameMode === "PRESENTATION";
  const isDemocracy = round.gameMode === "DEMOCRACY";
  const isChaos = round.gameMode === "CHAOS";
  const isDemocracyReveal = isDemocracy && round.democracy?.phase === "REVEAL";
  const isCurrent = isPresentation && round.currentPlayerId === snapshot.self.participantId;
  const selectedCard = round.selectedCardId
    ? round.cardBank.visibleCards.find((card) => card.id === round.selectedCardId) ?? null
    : null;
  const selfClaim = round.chaos?.claims.find((claim) => claim.isSelf) ?? null;
  const category = snapshot.categories.find((item) => item.key === round.categoryKey)?.label;
  const drag = activity.presentationDrag;
  const dragCard = drag
    ? round.cardBank.visibleCards.find((card) => card.id === drag.cardId) ?? null
    : null;
  const dragPlayer = drag
    ? round.playerQueue.find((player) => player.participantId === drag.participantId) ?? null
    : null;

  const startDrag = (card: MediaCard, event: DragEvent<HTMLElement>) => {
    const position = pointerPosition(event);
    activity.startPresentationDrag(card.id, position.x, position.y);
  };
  const moveDrag = (card: MediaCard, event: DragEvent<HTMLElement>) => {
    if (event.clientX === 0 && event.clientY === 0) return;
    const position = pointerPosition(event);
    activity.movePresentationDrag(card.id, position.x, position.y);
  };
  const endDrag = (card: MediaCard) => activity.endPresentationDrag(card.id);

  const moveIntoTier = (tier: Tier) => {
    if (isChaos && selfClaim) {
      setBusyAction(true);
      void activity.placeChaosCard(selfClaim.id, tier).finally(() => setBusyAction(false));
    } else if (isPresentation) {
      activity.moveCard(tier);
    }
  };

  return (
    <main className={`game-page game-page--${round.gameMode.toLowerCase()}`}>
      <header className="game-header">
        <div className="game-heading">
          <p className="game-wordmark">rankable.io</p>
          <div><span className="eyebrow">Category</span><h1>{category ?? round.categoryKey}</h1></div>
          <span className="game-mode-pill">{MODE_LABELS[round.gameMode]}</span>
        </div>
        <div className="game-header-actions">
          <SoundControls />
          {round.status === "PLAYING" && !isChaos && (
            <div className={`turn-clock ${(remaining ?? 16) <= 5 ? "turn-clock--urgent" : ""}`}>
              <span>
                {isDemocracy
                  ? isDemocracyReveal
                    ? "Next vote"
                    : "Vote now"
                  : isCurrent
                    ? "Your turn"
                    : `${round.playerQueue[0]?.username ?? "Player"}'s turn`}
              </span>
              <strong>{remaining ?? 0}</strong>
            </div>
          )}
          {round.status === "PLAYING" && isChaos && (
            <div className="turn-clock turn-clock--chaos"><span>Grab any card</span></div>
          )}
          {round.status === "RESULTS" && (
            <ResultsOverlay deadline={round.resultsEndsAt} serverTime={snapshot.serverTime} />
          )}
        </div>
      </header>

      {activity.error && <div className="game-error"><ActivityError message={activity.error} /></div>}
      <SkipNotice skippedCard={round.lastSkippedCard} />

      <div className="game-layout">
        <div className="tier-list-shell">
          <TierList
            placements={round.placements}
            activeCard={isPresentation ? selectedCard : null}
            endpoint={isPresentation ? round.currentEndpoint : "BANK"}
            canMove={
              round.status === "PLAYING" &&
              ((isPresentation && isCurrent && Boolean(selectedCard)) ||
                (isChaos && Boolean(selfClaim) && !busyAction))
            }
            onMove={moveIntoTier}
            onActiveDragStart={isPresentation ? startDrag : undefined}
            onActiveDrag={isPresentation ? moveDrag : undefined}
            onActiveDragEnd={isPresentation ? endDrag : undefined}
            highlightedCardId={
              isDemocracyReveal ? round.democracy?.lastResolvedCardId : null
            }
          />
          <EmoteMenu
            disabled={snapshot.self.membership !== "JOINED"}
            onEmote={activity.sendEmote}
          />
        </div>
        <div className="game-sidebar">
          <PlayerQueue
            players={round.playerQueue}
            emotes={activity.emotes}
            eyebrow={isPresentation ? "Turn order" : "Everyone plays"}
            title={isPresentation ? "Player queue" : isDemocracy ? "Voters" : "Players"}
          />
          {round.status === "PLAYING" && isPresentation && (
            <button
              className="button button--primary end-turn"
              disabled={!snapshot.capabilities.canEndTurn || busyAction}
              title={
                round.currentEndpoint === "BANK"
                  ? "Pass this turn without placing a card"
                  : "Place the selected card and end your turn"
              }
              onClick={() => {
                setBusyAction(true);
                void activity.endTurn().finally(() => setBusyAction(false));
              }}
            >
              End Turn
            </button>
          )}
        </div>
      </div>

      <CardBank
        cards={round.cardBank.visibleCards}
        remainingCount={round.cardBank.remainingCount}
        endpoint={isPresentation ? round.currentEndpoint : "BANK"}
        canMove={
          round.status === "PLAYING" &&
          ((isPresentation && isCurrent) || (isChaos && Boolean(selfClaim) && !busyAction))
        }
        selectedCardId={isPresentation ? round.selectedCardId : null}
        highlightFrontCard={!isChaos}
        allowAnyCard={isPresentation}
        canReturn={isPresentation}
        onReturn={() => activity.moveCard("BANK")}
        onCardDragStart={isPresentation ? startDrag : undefined}
        onCardDrag={isPresentation ? moveDrag : undefined}
        onCardDragEnd={isPresentation ? endDrag : undefined}
        onCardChoose={
          isChaos && round.status === "PLAYING" && !selfClaim && !busyAction
            ? (card) => {
                setBusyAction(true);
                void activity.claimChaosCard(card.id).finally(() => setBusyAction(false));
              }
            : undefined
        }
        heldCard={isChaos ? selfClaim : null}
        helpText={
          isPresentation && isCurrent
            ? "Choose any card · End Turn to pass"
            : isChaos
              ? selfClaim
                ? "Drag yours into a tier"
                : "Click any card to claim it"
              : `${round.cardBank.remainingCount} remaining`
        }
      />

      {isDemocracy && round.status === "PLAYING" && !isDemocracyReveal && selectedCard && round.democracy && (
        <DemocracyVoteModal
          card={selectedCard}
          votes={round.democracy.votes}
          eligibleVoterCount={round.democracy.eligibleVoterCount}
          remaining={remaining ?? 0}
          disabled={busyAction || snapshot.self.membership !== "JOINED"}
          onVote={(choice) => {
            setBusyAction(true);
            void activity.castVote(choice).finally(() => setBusyAction(false));
          }}
        />
      )}

      {round.status === "PLAYING" && snapshot.capabilities.canEndGame && (
        <button
          className="button end-game-button"
          disabled={busyAction}
          onClick={() => {
            setBusyAction(true);
            void activity.endGame().finally(() => setBusyAction(false));
          }}
        >
          End Game
        </button>
      )}

      {drag && dragCard && dragPlayer && drag.participantId !== snapshot.self.participantId && (
        <PresentationDragGhost drag={drag} card={dragCard} username={dragPlayer.username} />
      )}
    </main>
  );
}
