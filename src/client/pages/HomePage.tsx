import { useState } from "react";
import { useDiscordActivity } from "../discord/DiscordProvider.js";
import { ActivityError } from "../components/shared/ActivityError.js";
import { CountdownTimer } from "../components/home/CountdownTimer.js";
import { LeaderControls } from "../components/home/LeaderControls.js";
import { LobbyList } from "../components/home/LobbyList.js";
import { SoundControls } from "../components/shared/SoundControls.js";

export function HomePage() {
  const activity = useDiscordActivity();
  const snapshot = activity.snapshot!;
  const [busy, setBusy] = useState(false);

  return (
    <main className="home-page">
      <header className="brand-header">
        <span className="brand-mark">R</span>
        <div>
          <h1>rankable.io</h1>
          <p>Build the tier list together.</p>
        </div>
        <SoundControls />
      </header>

      <div className="home-content">
        <LeaderControls
          snapshot={snapshot}
          onStart={activity.startCountdown}
          onCancel={activity.cancelCountdown}
        />

        {snapshot.phase === "COUNTDOWN" && (
          <CountdownTimer
            deadline={snapshot.countdownEndsAt}
            serverTime={snapshot.serverTime}
          />
        )}

        {activity.error && <ActivityError message={activity.error} />}
        <LobbyList members={snapshot.members} />

        <div className="lobby-actions">
          {snapshot.capabilities.canJoin && (
            <button
              className="button button--primary button--wide"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void activity.joinLobby().finally(() => setBusy(false));
              }}
            >
              Join Lobby
            </button>
          )}
          {snapshot.capabilities.canLeave && (
            <button
              className="button button--ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void activity.leaveLobby().finally(() => setBusy(false));
              }}
            >
              Leave Lobby
            </button>
          )}
        </div>

        {snapshot.phase === "COUNTDOWN" && snapshot.capabilities.canJoin && (
          <p className="join-note">Joining now cancels the countdown so the leader can restart it.</p>
        )}
      </div>

      <footer className="home-legal-links" aria-label="Legal">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
        <span aria-hidden="true">·</span>
        <a href="/tos" target="_blank" rel="noreferrer">Terms</a>
      </footer>
    </main>
  );
}
