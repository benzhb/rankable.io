import { useServerTimer } from "../../hooks/useServerTimer.js";

export function ResultsOverlay({ deadline }: { deadline: string | null }) {
  const remaining = useServerTimer(deadline);
  return (
    <div className="results-banner" role="timer">
      <div><span className="eyebrow">Final ranking</span><strong>That’s the list.</strong></div>
      <div className="results-countdown"><span>Lobby in</span><strong>{remaining ?? 0}</strong></div>
    </div>
  );
}
