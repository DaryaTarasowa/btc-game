import type { BetDirection } from "@/api/bets";
import { BetDirection as Direction } from "@/domain/bets";

interface GameControlsProps {
  disabled?: boolean;
  onChoose: (direction: BetDirection) => void;
}

export function GameControls({ disabled = false, onChoose }: GameControlsProps) {
  const buttonClass = "min-w-0 flex-1 cursor-pointer rounded-full border-0 px-7 py-3.5 font-extrabold transition duration-150 enabled:hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70";
  return (
    <div className="mt-8 flex gap-2.5" aria-label="Price prediction controls">
      <button type="button" disabled={disabled} onClick={() => onChoose(Direction.Up)} className={`${buttonClass} bg-up text-[#06251b] enabled:hover:bg-[#63e5b5]`}>
        <span aria-hidden="true">↑</span> UP
      </button>
      <button type="button" disabled={disabled} onClick={() => onChoose(Direction.Down)} className={`${buttonClass} bg-down text-[#2d080b] enabled:hover:bg-[#ff8994]`}>
        <span aria-hidden="true">↓</span> DOWN
      </button>
    </div>
  );
}
