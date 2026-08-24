import type { LobbyMemberSnapshot } from "../../../shared/types/session.types.js";
import { Avatar } from "../shared/Avatar.js";

export function LobbyList({ members }: { members: LobbyMemberSnapshot[] }) {
  return (
    <section className="lobby-card" aria-labelledby="lobby-title">
      <div className="lobby-card__header">
        <div>
          <span className="eyebrow">Party</span>
          <h2 id="lobby-title">Lobby</h2>
        </div>
        <span className="member-count">{members.length}</span>
      </div>
      <div className="lobby-members">
        {members.length === 0 ? (
          <p className="empty-lobby">Nobody has joined yet. Be the first.</p>
        ) : members.map((member) => (
          <div className="lobby-member" key={member.participantId}>
            <Avatar src={member.avatarUrl} username={member.username} />
            <span className="lobby-member__name">{member.username}</span>
            {member.isSelf && <span className="you-badge">You</span>}
            {member.isLeader && <span className="leader-crown" aria-label="Party leader">♛</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
