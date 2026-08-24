import { useState } from "react";
import { useDiscordActivity } from "../discord/DiscordProvider.js";
import { useServerTimer } from "../hooks/useServerTimer.js";
import { ActivityError } from "../components/shared/ActivityError.js";
import { CardBank } from "../components/game/CardBank.js";
import { PlayerQueue } from "../components/game/PlayerQueue.js";
import { ResultsOverlay } from "../components/game/ResultsOverlay.js";
import { TierList } from "../components/game/TierList.js";
import { SoundControls } from "../components/shared/SoundControls.js";

export function GamePage() {
  const activity = useDiscordActivity();
  const snapshot = activity.snapshot!;
  const round = snapshot.round;
  const [ending, setEnding] = useState(false);
  const remaining = useServerTimer(round?.turnEndsAt ?? null);

  if (!round) return null;
  const activeCard = round.cardBank.visibleCards[0] ?? null;
  const isCurrent = round.currentPlayerId === snapshot.self.participantId;
  const category = snapshot.categories.find((item) => item.key === round.categoryKey)?.label;

  return (
    <main className="game-page">
      <header className="game-header">
        <div className="game-heading">
          <p className="game-wordmark">rankable.io</p>
          <div><span className="eyebrow">Category</span><h1>{category ?? round.categoryKey}</h1></div>
        </div>
        <div className="game-header-actions">
          <SoundControls />
          {round.status === "PLAYING" && (
            <div className={`turn-clock ${(remaining ?? 16) <= 5 ? "turn-clock--urgent" : ""}`}>
              <span>{isCurrent ? "Your turn" : `${round.playerQueue[0]?.username ?? "Player"}'s turn`}</span>
              <strong>{remaining ?? 0}</strong>
            </div>
          )}
          {round.status === "RESULTS" && <ResultsOverlay deadline={round.resultsEndsAt} />}
        </div>
      </header>

      {activity.error && <div className="game-error"><ActivityError message={activity.error} /></div>}

      <div className="game-layout">
        <TierList
          placements={round.placements}
          activeCard={activeCard}
          endpoint={round.currentEndpoint}
          canMove={isCurrent && round.status === "PLAYING"}
          onMove={activity.moveCard}
        />
        <div className="game-sidebar">
          <PlayerQueue players={round.playerQueue} />
          {round.status === "PLAYING" && (
            <button
              className="button button--primary end-turn"
              disabled={!snapshot.capabilities.canEndTurn || ending}
              title={round.currentEndpoint === "BANK" ? "Skip this card for your turn" : "Finish your turn"}
              onClick={() => {
                setEnding(true);
                void activity.endTurn().finally(() => setEnding(false));
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
        endpoint={round.currentEndpoint}
        canMove={isCurrent && round.status === "PLAYING"}
        onReturn={() => activity.moveCard("BANK")}
      />
    </main>
  );
}
