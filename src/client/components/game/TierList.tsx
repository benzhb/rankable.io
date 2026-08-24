import type { CardEndpoint, PlacementSnapshot, Tier } from "../../../shared/types/round.types.js";
import { TIERS } from "../../../shared/types/round.types.js";
import type { MediaCard } from "../../../shared/types/media.types.js";
import { MediaCardView } from "./MediaCardView.js";

const tierClass: Record<Tier, string> = {
  S: "tier--s",
  A: "tier--a",
  B: "tier--b",
  C: "tier--c",
  F: "tier--f",
};

export function TierList({
  placements,
  activeCard,
  endpoint,
  canMove,
  onMove,
}: {
  placements: PlacementSnapshot[];
  activeCard: MediaCard | null;
  endpoint: CardEndpoint;
  canMove: boolean;
  onMove: (tier: Tier) => void;
}) {
  return (
    <section className="tier-list" aria-label="Tier list">
      {TIERS.map((tier) => (
        <div
          className="tier-row"
          key={tier}
          onDragOver={(event) => {
            if (canMove) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (canMove) onMove(tier);
          }}
        >
          <div className={`tier-label ${tierClass[tier]}`}>{tier}</div>
          <div className="tier-cards">
            {placements
              .filter((placement) => placement.tier === tier)
              .map((placement) => (
                <MediaCardView key={placement.id} card={placement} />
              ))}
            {activeCard && endpoint === tier && (
              <MediaCardView card={activeCard} draggable={canMove} active />
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
