import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getCompletedBets, reconstructableBetHistory } from "@/api/bets";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { usePlayer } from "@/context/usePlayer";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function HistoryPage() {
  const { playerId, player } = usePlayer();
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["bets", playerId, "history"],
    queryFn: ({ signal }) => getCompletedBets(signal),
    enabled: Boolean(playerId),
  });
  const visibleHistory = reconstructableBetHistory(history.data ?? []);
  const selectedBet = visibleHistory.bets.find((bet) => bet.id === selectedBetId) ?? null;
  const historicalPrices = useResolvedBetChart(selectedBet);
  const emptyClass = "mt-10 text-[#8490a9]";

  return (
    <section className="mx-auto w-full max-w-[1100px] rounded-3xl border border-white/10 bg-[#141927]/85 p-[clamp(28px,4vw,52px)] text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
      <p className="mb-3 text-xs font-extrabold tracking-[0.22em] text-bitcoin">GAME HISTORY</p>
      {playerId ? (
        <>
          <h1 className="mb-7 text-[clamp(2rem,8vw,3.75rem)] leading-[0.98] tracking-[-0.045em]">Your predictions</h1>
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
                    <div
                      className={`relative grid w-full grid-cols-[100px_1fr_auto_28px] items-center gap-3.5 rounded-[14px] border bg-[#080b12]/50 px-4.5 py-4 text-left text-slate-200 max-[820px]:grid-cols-[80px_1fr_24px] ${selectedBetId === bet.id ? "border-bitcoin" : "border-white/10"}`}
                      key={bet.id}
                    >
                      <span className={`text-xs font-black tracking-[0.08em] ${bet.result === "won" ? "text-up" : "text-down"}`}>{bet.result === "won" ? "+1 WON" : "−1 LOST"}</span>
                      <strong>{bet.direction.toUpperCase()} · ${Number(bet.startPrice).toLocaleString()}</strong>
                      <small className="text-[#8490a9] max-[820px]:col-start-2">{dateFormatter.format(new Date(bet.startEventTimestamp))}</small>
                      <button
                        type="button"
                        className="grid size-[34px] min-w-0 cursor-pointer place-items-center rounded-[9px] border-0 bg-bitcoin/10 p-[7px] text-bitcoin transition hover:bg-bitcoin hover:text-[#171008] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white max-[820px]:col-start-3 max-[820px]:row-start-1"
                        aria-label="Show price chart"
                        title="Show price chart"
                        onClick={() => setSelectedBetId(bet.id)}
                      >
                        <svg className="size-full fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />
                        </svg>
                      </button>
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
          {selectedBet && (
            <div className="mt-7 text-left">
              {historicalPrices.isPending ? (
                <p className={emptyClass}>Reconstructing stored market window…</p>
              ) : historicalPrices.isError ? (
                <p className="mt-5.5 text-down">{historicalPrices.error.message}</p>
              ) : historicalPrices.data.length === 0 ? (
                <p className={emptyClass}>Stored market data is no longer available for this bet.</p>
              ) : (
                <PriceChart prices={historicalPrices.data} bet={selectedBet} staticHistory />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="mb-7 text-[clamp(2rem,8vw,3.75rem)] leading-[0.98] tracking-[-0.045em]">Login required</h1>
          <p className="m-0 leading-7 text-slate-300">Log in from the market page to see your prediction history.</p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-bitcoin/10 px-3.5 py-2 text-sm font-bold text-bitcoin no-underline transition hover:bg-bitcoin/20">Return to market</Link>
        </>
      )}
    </section>
  );
}
