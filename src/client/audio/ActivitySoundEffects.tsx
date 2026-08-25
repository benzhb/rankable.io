import { useEffect } from "react";
import { useDiscordActivity } from "../discord/DiscordProvider.js";
import { useSounds } from "./AudioProvider.js";

export const COUNTDOWN_TRACK_MS = 7_704;

export function playbackDelay(deadline: string | null, leadTime = 0, now = Date.now()): number | null {
  if (!deadline) return null;
  const deadlineAt = Date.parse(deadline);
  if (!Number.isFinite(deadlineAt) || deadlineAt <= now) return null;
  return Math.max(0, deadlineAt - now - leadTime);
}

export function shouldScheduleTimesUp(
  status: string | null | undefined,
  gameMode: string | null | undefined,
): boolean {
  return status === "PLAYING" && gameMode === "PRESENTATION";
}

export function ActivitySoundEffects() {
  const { snapshot } = useDiscordActivity();
  const { play, stop } = useSounds();
  const phase = snapshot?.phase ?? null;
  const countdownEndsAt = snapshot?.countdownEndsAt ?? null;
  const round = snapshot?.round ?? null;
  const serverNow = snapshot?.serverTime ? Date.parse(snapshot.serverTime) : Date.now();

  useEffect(() => {
    stop("countdown");
    if (phase !== "COUNTDOWN") return;
    const delay = playbackDelay(countdownEndsAt, COUNTDOWN_TRACK_MS, serverNow);
    if (delay === null) return;

    const timer = window.setTimeout(() => play("countdown"), delay);
    return () => {
      window.clearTimeout(timer);
      stop("countdown");
    };
  }, [countdownEndsAt, phase, play, stop]);

  useEffect(() => {
    stop("timesUp");
    if (!shouldScheduleTimesUp(round?.status, round?.gameMode)) return;
    const delay = playbackDelay(round?.turnEndsAt ?? null, 0, serverNow);
    if (delay === null) return;

    const timer = window.setTimeout(() => play("timesUp"), delay);
    return () => {
      window.clearTimeout(timer);
      stop("timesUp");
    };
  }, [play, round?.gameMode, round?.id, round?.status, round?.turnEndsAt, round?.turnNumber, stop]);

  return null;
}
