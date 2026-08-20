import { useEffect, type CSSProperties } from "react";
import type { ResolvedBet } from "@/api/bets";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { BetResult } from "@/domain/bets";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";
import {
  buttonStyle,
  eyebrowStyle,
  modalBackdropStyle,
  modalPanelStyle,
} from "@/styles/ui";

interface ResolvedBetModalProps {
  bet: ResolvedBet;
  origin: { x: number; y: number };
  onClose: () => void;
}

export function ResolvedBetModal({
  bet,
  origin,
  onClose,
}: ResolvedBetModalProps) {
  const resolvedPrices = useResolvedBetChart(bet);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const won = bet.result === BetResult.Won;

  return (
    <div
      className={modalBackdropStyle}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${modalPanelStyle} max-w-[980px] ${won ? "border-up/60" : "border-down/60"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolution-modal-title"
        style={
          {
            "--modal-origin-x": `${origin.x}px`,
            "--modal-origin-y": `${origin.y}px`,
          } as CSSProperties
        }
      >
        <header className="mb-4.5 flex items-start justify-between gap-5">
          <div>
            <p className={eyebrowStyle}>BET RESOLVED</p>
            <h2
              className={`m-0 text-[clamp(1.8rem,5vw,3.2rem)] leading-none ${won ? "text-up" : "text-down"}`}
              id="resolution-modal-title"
            >
              {won ? "You won +1" : "You lost −1"}
            </h2>
          </div>
          <button
            type="button"
            className={`${buttonStyle} grid size-[42px] min-w-[42px] place-items-center rounded-full bg-white/10 p-0 text-[1.7rem] text-white enabled:hover:-translate-y-0.5 enabled:hover:bg-white/20`}
            aria-label="Close resolved bet"
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {resolvedPrices.isPending ? (
          <p className="grid min-h-55 place-items-center text-[#8490a9]">
            Reconstructing stored market window…
          </p>
        ) : resolvedPrices.isError ? (
          <p className="mt-5.5 text-down">{resolvedPrices.error.message}</p>
        ) : resolvedPrices.data.length === 0 ? (
          <p className="grid min-h-55 place-items-center text-[#8490a9]">
            Stored market data is not available.
          </p>
        ) : (
          <PriceChart prices={resolvedPrices.data} bet={bet} staticHistory />
        )}
      </section>
    </div>
  );
}
