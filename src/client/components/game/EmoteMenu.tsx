import { useState } from "react";
import type { PlayerEmote } from "../../../shared/types/round.types.js";

const choices: Array<{ emote: PlayerEmote; symbol: string; label: string }> = [
  { emote: "THUMBS_UP", symbol: "👍", label: "Thumbs up" },
  { emote: "THUMBS_DOWN", symbol: "👎", label: "Thumbs down" },
];

export function EmoteMenu({ disabled, onEmote }: {
  disabled: boolean;
  onEmote: (emote: PlayerEmote) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="emote-menu">
      {open && (
        <div className="emote-menu__panel" role="menu" aria-label="Emotes">
          {choices.map((choice) => (
            <button
              type="button"
              role="menuitem"
              aria-label={choice.label}
              key={choice.emote}
              onClick={() => {
                onEmote(choice.emote);
                setOpen(false);
              }}
            >
              {choice.symbol}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="emote-menu__toggle"
        aria-label={open ? "Close emotes" : "Open emotes"}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        ☺
      </button>
    </div>
  );
}
