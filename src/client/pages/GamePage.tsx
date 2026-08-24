import { useState } from "react";
import { useDiscordActivity } from "../discord/DiscordProvider.js";
import { useServerTimer } from "../hooks/useServerTimer.js";
import { ActivityError } from "../components/shared/ActivityError.js";
import { CardBank } from "../components/game/CardBank.js";
import { PlayerQueue } from "../components/game/PlayerQueue.js";
import { ResultsOverlay } from "../components/game/ResultsOverlay.js";
import { TierList } from "../components/game/TierList.js";

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
        {round.status === "PLAYING" && (
          <div className={`turn-clock ${(remaining ?? 16) <= 5 ? "turn-clock--urgent" : ""}`}>
            <span>{isCurrent ? "Your turn" : `${round.playerQueue[0]?.username ?? "Player"}'s turn`}</span>
            <strong>{remaining ?? 0}</strong>
          </div>
        )}
      </header>

      {activity.error && <ActivityError message={activity.error} />}
      {round.status === "RESULTS" && <ResultsOverlay deadline={round.resultsEndsAt} />}

      <div className="game-layout">
        <TierList
          placements={round.placements}
          activeCard={activeCard}
          endpoint={round.currentEndpoint}
          canMove={isCurrent && round.status === "PLAYING"}
          onMove={activity.moveCard}
        />
        <PlayerQueue players={round.playerQueue} />
      </div>

      {round.status === "PLAYING" && (
        <button
          className="button button--primary end-turn"
          disabled={!snapshot.capabilities.canEndTurn || ending}
          onClick={() => {
            setEnding(true);
            void activity.endTurn().finally(() => setEnding(false));
          }}
        >
          End Turn
        </button>
      )}

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
