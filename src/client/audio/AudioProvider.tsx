import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SoundEngine, type SoundName } from "./sound-engine.js";

const SETTINGS_KEY = "rankable:sound-settings";

interface StoredSoundSettings {
  muted: boolean;
  volume: number;
}

interface AudioContextValue extends StoredSoundSettings {
  play: (name: SoundName) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  stop: (name: SoundName) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

function storedSettings(): StoredSoundSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return { muted: false, volume: 0.55 };
    const parsed = JSON.parse(stored) as Partial<StoredSoundSettings>;
    return {
      muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : 0.55,
    };
  } catch {
    return { muted: false, volume: 0.55 };
  }
}

const interactiveSelector = [
  "button:not(:disabled)",
  "select:not(:disabled)",
  'input[type="range"]',
  '[draggable="true"]',
].join(",");

export function AudioProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<SoundEngine | null>(null);
  const initialSettings = useRef(storedSettings());
  const [muted, updateMuted] = useState(initialSettings.current.muted);
  const [volume, updateVolume] = useState(initialSettings.current.volume);

  engineRef.current ??= new SoundEngine();
  const engine = engineRef.current;

  const play = useCallback((name: SoundName) => engine.play(name), [engine]);
  const stop = useCallback((name: SoundName) => engine.stop(name), [engine]);

  const setMuted = useCallback((nextMuted: boolean) => {
    engine.setMuted(nextMuted);
    updateMuted(nextMuted);
  }, [engine]);

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    engine.setVolume(clamped);
    updateVolume(clamped);
  }, [engine]);

  useEffect(() => {
    engine.setVolume(volume);
    engine.setMuted(muted);
  }, [engine, muted, volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted, volume }));
    } catch {
      // Storage can be unavailable in privacy-restricted embedded contexts.
    }
  }, [muted, volume]);

  useEffect(() => {
    let lastHoverAt = 0;
    const interactive = (target: EventTarget | null) =>
      target instanceof Element ? target.closest(interactiveSelector) : null;

    const handleClick = (event: MouseEvent) => {
      if (interactive(event.target)) play("click");
    };
    const handleDragStart = (event: DragEvent) => {
      if (interactive(event.target)) play("click");
    };
    const handleDrop = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest(".tier-row, .card-bank")) {
        play("click");
      }
    };
    const handlePointerOver = (event: PointerEvent) => {
      const target = interactive(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      const now = performance.now();
      if (now - lastHoverAt < 60) return;
      lastHoverAt = now;
      play("hover");
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("dragstart", handleDragStart, true);
    document.addEventListener("drop", handleDrop, true);
    document.addEventListener("pointerover", handlePointerOver, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("dragstart", handleDragStart, true);
      document.removeEventListener("drop", handleDrop, true);
      document.removeEventListener("pointerover", handlePointerOver, true);
      engine.stopAll();
    };
  }, [engine, play]);

  return (
    <AudioContext.Provider value={{ muted, volume, play, setMuted, setVolume, stop }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useSounds(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useSounds must be used inside AudioProvider");
  return context;
}
