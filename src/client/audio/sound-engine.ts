import countdownUrl from "../assets/sound/clock-ticking-countdown8secondsish.mp3";
import timesUpUrl from "../assets/sound/times-up-player.mp3";
import clickUrl from "../assets/sound/ui-click.mp3";
import hoverUrl from "../assets/sound/ui-hover.mp3";

export type SoundName = "countdown" | "timesUp" | "click" | "hover";

export interface SoundTrack {
  currentTime: number;
  preload: string;
  volume: number;
  load(): void;
  pause(): void;
  play(): Promise<void>;
}

const soundUrls: Record<SoundName, string> = {
  countdown: countdownUrl,
  timesUp: timesUpUrl,
  click: clickUrl,
  hover: hoverUrl,
};

const soundGains: Record<SoundName, number> = {
  countdown: 0.5,
  timesUp: 0.7,
  click: 0.55,
  hover: 0.18,
};

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

export class SoundEngine {
  private readonly tracks = new Map<SoundName, SoundTrack>();
  private volume = 0.55;
  private muted = false;

  constructor(createTrack: (url: string) => SoundTrack = (url) => new Audio(url)) {
    for (const [name, url] of Object.entries(soundUrls) as [SoundName, string][]) {
      const track = createTrack(url);
      track.preload = "auto";
      track.volume = this.trackVolume(name);
      track.load();
      this.tracks.set(name, track);
    }
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    for (const [name, track] of this.tracks) track.volume = this.trackVolume(name);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopAll();
  }

  play(name: SoundName): void {
    if (this.muted || this.volume === 0) return;
    const track = this.tracks.get(name);
    if (!track) return;

    track.pause();
    track.currentTime = 0;
    track.volume = this.trackVolume(name);
    void track.play().catch(() => {
      // Discord/browser autoplay policy can reject audio until the first user gesture.
    });
  }

  stop(name: SoundName): void {
    const track = this.tracks.get(name);
    if (!track) return;
    track.pause();
    track.currentTime = 0;
  }

  stopAll(): void {
    for (const name of this.tracks.keys()) this.stop(name);
  }

  private trackVolume(name: SoundName): number {
    return clampVolume(this.volume * soundGains[name]);
  }
}
