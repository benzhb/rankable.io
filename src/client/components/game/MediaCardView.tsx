import type { MediaCard } from "../../../shared/types/media.types.js";

export function MediaCardView({ card, draggable = false, active = false }: {
  card: MediaCard;
  draggable?: boolean;
  active?: boolean;
}) {
  return (
    <article
      className={`media-card ${active ? "media-card--active" : ""}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
      }}
      data-card-id={card.id}
    >
      <img src={card.imageUrl} alt="" draggable={false} />
      <span>{card.title}</span>
    </article>
  );
}
