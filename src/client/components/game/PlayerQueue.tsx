import type { QueuedPlayerSnapshot } from "../../../shared/types/round.types.js";
import { Avatar } from "../shared/Avatar.js";

export function PlayerQueue({ players }: { players: QueuedPlayerSnapshot[] }) {
  return (
    <aside className="player-queue" aria-labelledby="queue-heading">
      <span className="eyebrow">Turn order</span>
      <h2 id="queue-heading">Player queue</h2>
      <div className="player-queue__list">
        {players.map((player, index) => (
          <div
            className={`queued-player ${player.isCurrent ? "queued-player--current" : ""}`}
            key={player.participantId}
          >
            <span className="queue-position">{index + 1}</span>
            <Avatar src={player.avatarUrl} username={player.username} size="small" />
            <span>{player.username}</span>
            {player.isCurrent && <span className="turn-dot" aria-label="Current turn" />}
          </div>
        ))}
      </div>
    </aside>
  );
}
