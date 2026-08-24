import { useServerTimer } from "../../hooks/useServerTimer.js";

export function CountdownTimer({ deadline, label = "Game starts in" }: {
  deadline: string | null;
  label?: string;
}) {
  const remaining = useServerTimer(deadline);
  if (remaining === null) return null;
  return (
    <div className="countdown" role="timer" aria-live="polite">
      <span>{label}</span>
      <strong>{remaining}</strong>
    </div>
  );
}
