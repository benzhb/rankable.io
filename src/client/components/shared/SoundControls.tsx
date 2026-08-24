import { useSounds } from "../../audio/AudioProvider.js";

export function SoundControls() {
  const { muted, setMuted, setVolume, volume } = useSounds();

  return (
    <div className="sound-controls" aria-label="Sound controls">
      <button
        type="button"
        className="sound-toggle"
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
      >
        <span aria-hidden="true">{muted ? "♪×" : "♪"}</span>
        <span>{muted ? "Off" : "On"}</span>
      </button>
      <label className="sound-volume">
        <span className="visually-hidden">Sound volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          aria-label="Sound volume"
          onChange={(event) => setVolume(event.currentTarget.valueAsNumber)}
        />
      </label>
    </div>
  );
}
