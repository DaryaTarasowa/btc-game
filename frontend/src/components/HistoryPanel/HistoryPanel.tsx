import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getCompletedBets, reconstructableBetHistory } from "@/api/bets";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { usePlayer } from "@/context/usePlayer";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";
import { BetResult } from "@/domain/bets";
import {
  buttonStyle,
  eyebrowStyle,
  pageCardStyle,
  pageTitleStyle,
} from "@/styles/ui";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function HistoryPanel() {
  const { playerId, player } = usePlayer();
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["bets", playerId, "history"],
    queryFn: ({ signal }) => getCompletedBets(signal),
    enabled: Boolean(playerId),
  });
  const visibleHistory = reconstructableBetHistory(history.data ?? []);
  const selectedBet = visibleHistory.bets.find((bet) => bet.betId === selectedBetId) ?? null;
  const historicalPrices = useResolvedBetChart(selectedBet);
  const emptyClass = "mt-10 text-[#8490a9]";

  return (
    <section className={`${pageCardStyle} w-full`}>
      <p className={eyebrowStyle}>GAME HISTORY</p>
      {playerId ? (
        <>
          <h1 className={pageTitleStyle}>Your predictions</h1>
          <p className="m-0 leading-7 text-slate-300">History for <strong className="text-white">{player?.username}</strong></p>
          {history.isPending ? (
            <p className={emptyClass}>Loading completed predictions…</p>
          ) : history.isError ? (
            <p className="mt-5.5 text-down">{history.error.message}</p>
          ) : history.data.length === 0 ? (
            <p className={emptyClass}>No completed predictions yet.</p>
          ) : (
            <>
              {visibleHistory.bets.length > 0 ? (
                <div className="mt-8 grid gap-2.5">
                  {visibleHistory.bets.map((bet) => (
                    <div className="grid gap-2.5" key={bet.betId}>
                      <div
                        className={`relative grid w-full grid-cols-[100px_1fr_auto_28px] items-center gap-3.5 rounded-[14px] border bg-[#080b12]/50 px-4.5 py-4 text-left text-slate-200 max-[820px]:grid-cols-[80px_1fr_24px] ${selectedBetId === bet.betId ? "border-bitcoin" : "border-white/10"}`}
                      >
                        <span className={`text-xs font-black tracking-[0.08em] ${bet.result === BetResult.Won ? "text-up" : "text-down"}`}>{bet.result === BetResult.Won ? "+1 WON" : "−1 LOST"}</span>
                        <strong>{bet.direction.toUpperCase()} · ${Number(bet.startPrice).toLocaleString()}</strong>
                        <small className="text-[#8490a9] max-[820px]:col-start-2">{dateFormatter.format(new Date(bet.startEventTimestamp))}</small>
                        <button
                          type="button"
                          className={`${buttonStyle} grid size-[34px] min-w-0 place-items-center rounded-[9px] bg-bitcoin/10 p-[7px] text-bitcoin hover:bg-bitcoin hover:text-[#171008] max-[820px]:col-start-3 max-[820px]:row-start-1`}
                          aria-label={selectedBetId === bet.betId ? "Hide price chart" : "Show price chart"}
                          title={selectedBetId === bet.betId ? "Hide price chart" : "Show price chart"}
                          aria-expanded={selectedBetId === bet.betId}
                          onClick={() => setSelectedBetId((current) => current === bet.betId ? null : bet.betId)}
                        >
                          <svg className="size-full fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />
                          </svg>
                        </button>
                      </div>
                      {selectedBetId === bet.betId && selectedBet && (
                        <div className="mb-4 text-left">
                          {historicalPrices.isPending ? (
                            <p className="my-6 text-center text-[#8490a9]">Reconstructing stored market window…</p>
                          ) : historicalPrices.isError ? (
                            <p className="my-6 text-center text-down">{historicalPrices.error.message}</p>
                          ) : historicalPrices.data.length === 0 ? (
                            <p className="my-6 text-center text-[#8490a9]">Stored market data is no longer available for this bet.</p>
                          ) : (
                            <PriceChart prices={historicalPrices.data} bet={selectedBet} staticHistory />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={emptyClass}>No bets with available price charts.</p>
              )}
              {visibleHistory.olderCount > 0 && (
                <p className="mt-4.5 text-sm text-[#8490a9]">…and {visibleHistory.olderCount} older {visibleHistory.olderCount === 1 ? "bet" : "bets"}.</p>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <h1 className={pageTitleStyle}>Login required</h1>
          <p className="m-0 leading-7 text-slate-300">Log in from the market page to see your prediction history.</p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-bitcoin/10 px-3.5 py-2 text-sm font-bold text-bitcoin no-underline transition hover:bg-bitcoin/20">Return to market</Link>
        </>
      )}
    </section>
  );
}
