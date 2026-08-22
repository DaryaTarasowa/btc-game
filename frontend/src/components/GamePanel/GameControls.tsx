import { BetDirection } from "@/domain/bets";
import { actionButtonStyle } from "@/styles/ui";

const betButtonStyle = `${actionButtonStyle} min-w-0 flex-1 enabled:hover:-translate-y-0.5`;

const upButton = `
  ${betButtonStyle}
  bg-success text-[#06251b] enabled:hover:bg-[#63e5b5]
`;

const downButton = `
  ${betButtonStyle}
  bg-error text-[#2d080b] enabled:hover:bg-[#ff8994]
`;

interface BetButtonProps {
  direction: BetDirection;
  disabled?: boolean;
  onClick: () => void;
}

function BetButton({ direction, disabled, onClick }: BetButtonProps) {
  const isUp = direction === BetDirection.Up;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={isUp ? upButton : downButton}
    >
      <span aria-hidden="true">
        {isUp ? "↑" : "↓"} {isUp ? " UP" : " DOWN"}
      </span>
    </button>
  );
}

interface GameControlsProps {
  disabled?: boolean;
  onChoose: (direction: BetDirection) => void;
}

export function GameControls({
  disabled = false,
  onChoose,
}: GameControlsProps) {
  return (
    <div className="mt-8 flex gap-2.5" aria-label="Price prediction controls">
      <BetButton
        direction={BetDirection.Up}
        disabled={disabled}
        onClick={() => onChoose(BetDirection.Up)}
      />

      <BetButton
        direction={BetDirection.Down}
        disabled={disabled}
        onClick={() => onChoose(BetDirection.Down)}
      />
    </div>
  );
}
