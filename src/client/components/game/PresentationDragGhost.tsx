import type { MediaCard } from "../../../shared/types/media.types.js";
import type { PresentationDragEvent } from "../../../shared/types/round.types.js";

export function PresentationDragGhost({
  drag,
  card,
  username,
}: {
  drag: PresentationDragEvent;
  card: MediaCard;
  username: string;
}) {
  return (
    <div
      className="presentation-drag-ghost"
      style={{ left: `${drag.x * 100}%`, top: `${drag.y * 100}%` }}
      aria-hidden="true"
    >
      <img src={card.imageUrl} alt="" />
      <span>{username}</span>
    </div>
  );
}
