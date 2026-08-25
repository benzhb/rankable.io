import { describe, expect, it, vi } from "vitest";
import {
  COUNTDOWN_TRACK_MS,
  playbackDelay,
  shouldScheduleTimesUp,
} from "../../src/client/audio/ActivitySoundEffects.js";
import { serverRemainingSeconds } from "../../src/client/hooks/useServerTimer.js";
import { SoundEngine, type SoundTrack } from "../../src/client/audio/sound-engine.js";

function fakeTrack(): SoundTrack & {
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
} {
  return {
    currentTime: 12,
    preload: "none",
    volume: 1,
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
  };
}

describe("Activity sounds", () => {
  it("preloads clips and applies per-sound gain to playback", () => {
    const tracks: SoundTrack[] = [];
    const engine = new SoundEngine(() => {
      const track = fakeTrack();
      tracks.push(track);
      return track;
    });

    expect(tracks).toHaveLength(4);
    expect(tracks.every((track) => track.preload === "auto")).toBe(true);
    expect(tracks.every((track) => vi.mocked(track.load).mock.calls.length === 1)).toBe(true);

    engine.setVolume(0.8);
    engine.play("timesUp");
    const timesUp = tracks[1]!;
    expect(timesUp.currentTime).toBe(0);
    expect(timesUp.volume).toBeCloseTo(0.56);
    expect(timesUp.play).toHaveBeenCalledOnce();
  });

  it("stops active sounds and blocks playback while muted", () => {
    const tracks: SoundTrack[] = [];
    const engine = new SoundEngine(() => {
      const track = fakeTrack();
      tracks.push(track);
      return track;
    });

    engine.setMuted(true);
    engine.play("click");

    expect(tracks.every((track) => track.currentTime === 0)).toBe(true);
    expect(tracks.every((track) => vi.mocked(track.pause).mock.calls.length === 1)).toBe(true);
    expect(tracks.every((track) => vi.mocked(track.play).mock.calls.length === 0)).toBe(true);
  });

  it("starts the ticking clip for the final length of the lobby countdown", () => {
    const now = Date.parse("2026-08-23T20:00:00.000Z");
    const deadline = new Date(now + 10_000).toISOString();

    expect(playbackDelay(deadline, COUNTDOWN_TRACK_MS, now)).toBe(2_296);
    expect(playbackDelay(new Date(now - 1).toISOString(), 0, now)).toBeNull();
  });

  it("uses the server clock instead of the device clock for visible timers", () => {
    const serverTime = "2026-08-23T20:00:00.000Z";
    const deadline = "2026-08-23T20:00:15.000Z";

    expect(serverRemainingSeconds(deadline, serverTime)).toBe(15);
    expect(serverRemainingSeconds(deadline, serverTime, 5_001)).toBe(10);
  });

  it("does not play the turn timeout sound during Democracy voting or reveal", () => {
    expect(shouldScheduleTimesUp("PLAYING", "DEMOCRACY")).toBe(false);
    expect(shouldScheduleTimesUp("PLAYING", "PRESENTATION")).toBe(true);
    expect(shouldScheduleTimesUp("RESULTS", "PRESENTATION")).toBe(false);
  });
});
