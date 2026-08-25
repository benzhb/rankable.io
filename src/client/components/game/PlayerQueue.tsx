import type {
  PlayerEmoteEvent,
  QueuedPlayerSnapshot,
} from "../../../shared/types/round.types.js";
import { Avatar } from "../shared/Avatar.js";

const emoteSymbol = {
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
} as const;

export function PlayerQueue({ players, emotes = {}, eyebrow = "Turn order", title = "Player queue" }: {
  players: QueuedPlayerSnapshot[];
  emotes?: Readonly<Record<string, PlayerEmoteEvent>>;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <aside className="player-queue" aria-labelledby="queue-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2 id="queue-heading">{title}</h2>
      <div className="player-queue__list">
        {players.map((player, index) => (
          <div
            className={`queued-player ${player.isCurrent ? "queued-player--current" : ""}`}
            key={player.participantId}
          >
            <span className="queue-position">{index + 1}</span>
            <Avatar src={player.avatarUrl} username={player.username} size="small" />
            <span className="queued-player__name">
              {player.username}
              {emotes[player.participantId] && (
                <span
                  className="player-emote-bubble"
                  aria-label={`${player.username} reacted ${emoteSymbol[emotes[player.participantId]!.emote]}`}
                  key={emotes[player.participantId]!.sentAt}
                >
                  {emoteSymbol[emotes[player.participantId]!.emote]}
                </span>
              )}
            </span>
            {player.isCurrent && <span className="turn-dot" aria-label="Current turn" />}
          </div>
        ))}
      </div>
    </aside>
  );
}
