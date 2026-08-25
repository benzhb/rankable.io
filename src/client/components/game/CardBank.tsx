import type { CardEndpoint } from "../../../shared/types/round.types.js";
import type { MediaCard } from "../../../shared/types/media.types.js";
import type { DragEvent } from "react";
import { MediaCardView } from "./MediaCardView.js";

export function CardBank({
  cards,
  remainingCount,
  endpoint,
  canMove,
  onReturn,
  selectedCardId,
  highlightFrontCard = true,
  allowAnyCard = false,
  canReturn = true,
  onCardDragStart,
  onCardDrag,
  onCardDragEnd,
  onCardChoose,
  helpText,
  heldCard,
  onHeldCardDragStart,
  onHeldCardDragEnd,
}: {
  cards: MediaCard[];
  remainingCount: number;
  endpoint: CardEndpoint;
  canMove: boolean;
  onReturn: () => void;
  selectedCardId?: string | null;
  highlightFrontCard?: boolean;
  allowAnyCard?: boolean;
  canReturn?: boolean;
  onCardDragStart?: (card: MediaCard, event: DragEvent<HTMLElement>) => void;
  onCardDrag?: (card: MediaCard, event: DragEvent<HTMLElement>) => void;
  onCardDragEnd?: (card: MediaCard, event: DragEvent<HTMLElement>) => void;
  onCardChoose?: (card: MediaCard) => void;
  helpText?: string;
  heldCard?: MediaCard | null;
  onHeldCardDragStart?: (card: MediaCard, event: DragEvent<HTMLElement>) => void;
  onHeldCardDragEnd?: (card: MediaCard, event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <section
      className="card-bank"
      aria-label="Card queue"
      onDragOver={(event) => {
        if (canMove && canReturn) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (canMove && canReturn) onReturn();
      }}
    >
      <div className="card-bank__title">
        <div><span className="eyebrow">Up next</span><h2>Card queue</h2></div>
        <span>{helpText ?? (canMove && endpoint === "BANK" ? "End Turn to pass" : `${remainingCount} remaining`)}</span>
      </div>
      <div className="card-bank__row">
        {heldCard && (
          <div className="chaos-held-card">
            <span>Yours</span>
            <MediaCardView
              card={heldCard}
              active
              draggable={canMove}
              onDragStart={(event) => onHeldCardDragStart?.(heldCard, event)}
              onDragEnd={(event) => onHeldCardDragEnd?.(heldCard, event)}
            />
          </div>
        )}
        {cards.map((card, index) => {
          const isActiveCard = selectedCardId
            ? card.id === selectedCardId
            : highlightFrontCard && index === 0;
          if (isActiveCard && endpoint !== "BANK") {
            return <div className="media-card media-card--placeholder" key={card.id}>In play</div>;
          }
          return (
            <MediaCardView
              key={card.id}
              card={card}
              active={isActiveCard}
              draggable={canMove && (allowAnyCard || isActiveCard)}
              interactive={Boolean(onCardChoose)}
              onDragStart={(event) => onCardDragStart?.(card, event)}
              onDrag={(event) => onCardDrag?.(card, event)}
              onDragEnd={(event) => onCardDragEnd?.(card, event)}
              onClick={() => onCardChoose?.(card)}
            />
          );
        })}
      </div>
    </section>
  );
}
