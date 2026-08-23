import type { ResolvedBet } from "@/api/bets";
import { HistoryBetChart } from "@/views/HistoryView/HistoryBetChart";
import { BetDirection, BetResult } from "@/domain/bets";
import { buttonStyle } from "@/styles/ui";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

const historyBetItemStyle =
  "relative grid w-full grid-cols-[100px_1fr_auto_28px] items-center gap-3.5 rounded-[14px] border bg-ink px-4.5 py-4 text-left text-white max-[820px]:grid-cols-[80px_1fr_24px] hover:border-accent hover:cursor-pointer hover:-translate-y-0.5";

const chartToggleButtonStyle = `${buttonStyle} grid size-[34px] min-w-0 place-items-center rounded-[9px] bg-accent/10 p-[7px] text-accent hover:bg-accent hover:text-white max-[820px]:col-start-3 max-[820px]:row-start-1`;

interface HistoryBetItemProps {
  bet: ResolvedBet;
  expanded: boolean;
  onToggle: () => void;
}

function HistoryBetItem({ bet, expanded, onToggle }: HistoryBetItemProps) {
  const won = bet.result === BetResult.Won;
  const isUp = bet.direction === BetDirection.Up;
  const chartAction = expanded ? "Hide price chart" : "Show price chart";

  return (
    <div className="grid gap-2.5">
      <div
        title={chartAction}
        aria-label={chartAction}
        className={`${historyBetItemStyle} ${expanded ? "border-accent" : "border-opaque"}`}
        onClick={onToggle}
      >
        <span
          className={`text-xs font-black tracking-[0.08em] ${won ? "text-success" : "text-danger"}`}
        >
          {won ? "+1 WON" : "−1 LOST"}
        </span>
        <strong>
          <span className={`${isUp ? "text-up" : "text-down"}`}>
            {bet.direction.toUpperCase()}
          </span>{" "}
          · ${Number(bet.startPrice).toLocaleString()}{" "}
          <span className={won ? "text-success" : "text-danger"}>➜</span> $
          {Number(bet.endPrice).toLocaleString()}
        </strong>
        <small className="text-muted max-[820px]:col-start-2">
          {dateFormatter.format(new Date(bet.startEventTimestamp))}
        </small>
        <button
          className={chartToggleButtonStyle}
          aria-label={chartAction}
          title={chartAction}
          aria-expanded={expanded}
        >
          <svg
            className="size-full fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />
          </svg>
        </button>
      </div>
      {expanded && <HistoryBetChart bet={bet} />}
    </div>
  );
}

interface HistoryBetListProps {
  bets: ResolvedBet[];
  olderCount: number;
  selectedBetId: string | null;
  onSelect: (betId: string) => void;
}

export function HistoryBetList({
  bets,
  olderCount,
  selectedBetId,
  onSelect,
}: HistoryBetListProps) {
  return (
    <>
      {bets.length > 0 ? (
        <div className="mt-8 grid gap-2.5">
          {bets.map((bet) => (
            <HistoryBetItem
              key={bet.betId}
              bet={bet}
              expanded={selectedBetId === bet.betId}
              onToggle={() => onSelect(bet.betId)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-muted">No bets with available price charts.</p>
      )}

      {olderCount > 0 && (
        <p className="mt-4.5 text-sm text-muted">
          …and {olderCount} older {olderCount === 1 ? "bet" : "bets"}.
        </p>
      )}
    </>
  );
}
