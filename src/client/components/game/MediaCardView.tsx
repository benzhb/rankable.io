import type { DragEvent, MouseEvent } from "react";
import type { MediaCard } from "../../../shared/types/media.types.js";

export function MediaCardView({
  card,
  draggable = false,
  active = false,
  highlighted = false,
  interactive = false,
  onDragStart,
  onDrag,
  onDragEnd,
  onClick,
}: {
  card: MediaCard;
  draggable?: boolean;
  active?: boolean;
  highlighted?: boolean;
  interactive?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDrag?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className={`media-card ${active ? "media-card--active" : ""} ${highlighted ? "media-card--highlighted" : ""} ${interactive ? "media-card--interactive" : ""}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
        onDragStart?.(event);
      }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-card-id={card.id}
    >
      <img src={card.imageUrl} alt={card.title} draggable={false} />
      <span>{card.title}</span>
    </article>
  );
}
