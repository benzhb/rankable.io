import { useEffect, useState } from "react";

export function serverRemainingSeconds(
  deadline: string | null,
  serverTime: string,
  elapsedMs = 0,
): number | null {
  if (!deadline) return null;
  const deadlineAt = Date.parse(deadline);
  const serverNow = Date.parse(serverTime);
  if (!Number.isFinite(deadlineAt) || !Number.isFinite(serverNow)) return null;
  return Math.max(0, Math.ceil((deadlineAt - serverNow - elapsedMs) / 1_000));
}

export function useServerTimer(deadline: string | null, serverTime: string): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    serverRemainingSeconds(deadline, serverTime));

  useEffect(() => {
    const startedAt = performance.now();
    const calculate = () =>
      serverRemainingSeconds(deadline, serverTime, performance.now() - startedAt);
    setRemaining(calculate());
    if (!deadline) return;
    const timer = window.setInterval(() => setRemaining(calculate()), 200);
    return () => window.clearInterval(timer);
  }, [deadline, serverTime]);

  return remaining;
}
