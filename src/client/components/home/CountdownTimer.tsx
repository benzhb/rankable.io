import { useServerTimer } from "../../hooks/useServerTimer.js";

export function CountdownTimer({ deadline, serverTime, label = "Game starts in" }: {
  deadline: string | null;
  serverTime: string;
  label?: string;
}) {
  const remaining = useServerTimer(deadline, serverTime);
  if (remaining === null) return null;
  return (
    <div className="countdown" role="timer" aria-live="polite">
      <span>{label}</span>
      <strong>{remaining}</strong>
    </div>
  );
}
