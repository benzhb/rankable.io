import { useEffect, useState } from "react";
import type { SessionSnapshot } from "../../../shared/types/session.types.js";

export function LeaderControls({ snapshot, onStart, onCancel }: {
  snapshot: SessionSnapshot;
  onStart: (categoryKey: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const firstCategory = snapshot.categories[0]?.key ?? "";
  const [category, setCategory] = useState(snapshot.selectedCategoryKey ?? firstCategory);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCategory(snapshot.selectedCategoryKey ?? firstCategory);
  }, [snapshot.selectedCategoryKey, firstCategory]);

  if (!snapshot.self.isLeader) return null;
  const countingDown = snapshot.phase === "COUNTDOWN";

  return (
    <section className="leader-controls" aria-label="Party leader controls">
      <label>
        <span>Category</span>
        <select
          value={category}
          disabled={!snapshot.capabilities.canSelectCategory || busy}
          onChange={(event) => setCategory(event.target.value)}
        >
          {snapshot.categories.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} · {option.cardCount} cards
            </option>
          ))}
        </select>
      </label>
      <button
        className={countingDown ? "button button--danger" : "button button--primary"}
        disabled={busy || (!countingDown && (!category || !snapshot.capabilities.canStartCountdown))}
        onClick={() => {
          setBusy(true);
          void (countingDown ? onCancel() : onStart(category)).finally(() => setBusy(false));
        }}
      >
        {countingDown ? "Stop" : "Start Game"}
      </button>
    </section>
  );
}
