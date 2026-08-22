import type { ResolvedBet } from "@/api/bets";
import { Modal } from "@/components/Modal/Modal";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { BetResult } from "@/domain/bets";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";
import { HistoryBetChart } from "../HistoryView/HistoryBetChart";
import { getThemeColor } from "../../utils";

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
  const won = bet.result === BetResult.Won;

  return (
    <Modal
      className={`max-w-[980px] ${won ? "border-success/60" : "border-error/60"}`}
      origin={origin}
      onClose={onClose}
      eyebrow="BET RESOLVED"
      title={
        <span className={won ? "text-success" : "text-error"}>
          {won ? "You won +1" : "You lost −1"}
        </span>
      }
    >
      <HistoryBetChart bet={bet} />
    </Modal>
  );
}
