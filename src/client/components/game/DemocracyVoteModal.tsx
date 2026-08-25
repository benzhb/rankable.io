import type { MediaCard } from "../../../shared/types/media.types.js";
import type {
  DemocracyChoice,
  DemocracyVoteSnapshot,
  Tier,
} from "../../../shared/types/round.types.js";
import { TIERS } from "../../../shared/types/round.types.js";
import { Avatar } from "../shared/Avatar.js";

export function DemocracyVoteModal({
  card,
  votes,
  eligibleVoterCount,
  remaining,
  disabled,
  onVote,
}: {
  card: MediaCard;
  votes: DemocracyVoteSnapshot[];
  eligibleVoterCount: number;
  remaining: number;
  disabled: boolean;
  onVote: (choice: DemocracyChoice) => void;
}) {
  const selfVote = votes.find((vote) => vote.isSelf);
  const votersFor = (tier: Tier) => votes.filter((vote) => vote.choice === tier);
  const abstentions = votes.filter((vote) => vote.choice === "HAVENT_TRIED");

  return (
    <div className="democracy-backdrop">
      <section
        className="democracy-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Vote on ${card.title}`}
      >
        <div className="democracy-card">
          <img src={card.imageUrl} alt={card.title} />
          <div>
            <span className="eyebrow">Democracy vote</span>
            <h2>{card.title}</h2>
            <p>{votes.length} of {eligibleVoterCount} voted · {remaining}s</p>
          </div>
        </div>

        <div className="democracy-options">
          {TIERS.map((tier) => (
            <div className={`democracy-option democracy-option--${tier.toLowerCase()}`} key={tier}>
              <button
                className="democracy-tier-button"
                disabled={disabled || Boolean(selfVote)}
                onClick={() => onVote(tier)}
              >
                {tier}
              </button>
              <div className="democracy-voters" aria-label={`${tier} voters`}>
                {votersFor(tier).map((vote) => (
                  <div className="democracy-voter" key={vote.participantId}>
                    <Avatar src={vote.avatarUrl} username={vote.username} size="small" />
                    <span>{vote.username}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          className="button button--ghost democracy-abstain"
          disabled={disabled || Boolean(selfVote)}
          onClick={() => onVote("HAVENT_TRIED")}
        >
          Haven&apos;t tried
          {abstentions.length > 0 && <span>{abstentions.length}</span>}
        </button>
        {selfVote && <p className="democracy-locked">Your vote is locked in.</p>}
      </section>
    </div>
  );
}
