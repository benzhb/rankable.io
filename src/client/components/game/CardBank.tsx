import type { CardEndpoint } from "../../../shared/types/round.types.js";
import type { MediaCard } from "../../../shared/types/media.types.js";
import { MediaCardView } from "./MediaCardView.js";

export function CardBank({
  cards,
  remainingCount,
  endpoint,
  canMove,
  onReturn,
}: {
  cards: MediaCard[];
  remainingCount: number;
  endpoint: CardEndpoint;
  canMove: boolean;
  onReturn: () => void;
}) {
  return (
    <section
      className="card-bank"
      aria-label="Card queue"
      onDragOver={(event) => {
        if (canMove) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (canMove) onReturn();
      }}
    >
      <div className="card-bank__title">
        <div><span className="eyebrow">Up next</span><h2>Card queue</h2></div>
        <span>{remainingCount} remaining</span>
      </div>
      <div className="card-bank__row">
        {cards.map((card, index) => {
          const isActiveCard = index === 0;
          if (isActiveCard && endpoint !== "BANK") {
            return <div className="media-card media-card--placeholder" key={card.id}>In play</div>;
          }
          return (
            <MediaCardView
              key={card.id}
              card={card}
              active={isActiveCard}
              draggable={canMove && isActiveCard}
            />
          );
        })}
      </div>
    </section>
  );
}
