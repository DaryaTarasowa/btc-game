import type { BetDirection } from "@/api/bets";

interface GameControlsProps {
  disabled?: boolean;
  onChoose: (direction: BetDirection) => void;
}

export function GameControls({ disabled = false, onChoose }: GameControlsProps) {
  return (
    <div className="game-controls" aria-label="Price prediction controls">
      <button type="button" disabled={disabled} onClick={() => onChoose("up")} className="game-controls__button game-controls__button--up">
        <span aria-hidden="true">↑</span> UP
      </button>
      <button type="button" disabled={disabled} onClick={() => onChoose("down")} className="game-controls__button game-controls__button--down">
        <span aria-hidden="true">↓</span> DOWN
      </button>
    </div>
  );
}
