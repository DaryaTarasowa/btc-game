import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { betChartWindow, getCompletedBets, reconstructableBetHistory } from "@/api/bets";
import { getRecentPrices } from "@/api/prices";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { usePlayer } from "@/context/usePlayer";

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
  const historicalPrices = useQuery({
    queryKey: ["prices", "bet", selectedBet?.id],
    queryFn: ({ signal }) => getRecentPrices({ ...betChartWindow(selectedBet!), signal }),
    enabled: Boolean(selectedBet),
  });

  return (
    <section className="history-page">
      <p className="eyebrow">GAME HISTORY</p>
      {playerId ? (
        <>
          <h1>Your predictions</h1>
          <p className="identity">History for <strong>{player?.username}</strong></p>
          {history.isPending ? (
            <p className="history-page__empty">Loading completed predictions…</p>
          ) : history.isError ? (
            <p className="error">{history.error.message}</p>
          ) : history.data.length === 0 ? (
            <p className="history-page__empty">No completed predictions yet.</p>
          ) : (
            <>
              {visibleHistory.bets.length > 0 ? (
                <div className="history-list">
                  {visibleHistory.bets.map((bet) => (
                    <div
                      className={`history-bet history-bet--${bet.result}${selectedBetId === bet.id ? " history-bet--selected" : ""}`}
                      key={bet.id}
                    >
                      <span className="history-bet__result">{bet.result === "won" ? "+1 WON" : "−1 LOST"}</span>
                      <strong>{bet.direction.toUpperCase()} · ${Number(bet.startPrice).toLocaleString()}</strong>
                      <small>{dateFormatter.format(new Date(bet.startEventTimestamp))}</small>
                      <button
                        type="button"
                        className="history-bet__chart"
                        aria-label="Show price chart"
                        title="Show price chart"
                        onClick={() => setSelectedBetId(bet.id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="history-page__empty">No bets with available price charts.</p>
              )}
              {visibleHistory.olderCount > 0 && (
                <p className="history-page__older">…and {visibleHistory.olderCount} older {visibleHistory.olderCount === 1 ? "bet" : "bets"}.</p>
              )}
            </>
          )}
          {selectedBet && (
            <div className="history-chart">
              {historicalPrices.isPending ? (
                <p className="history-page__empty">Reconstructing stored market window…</p>
              ) : historicalPrices.isError ? (
                <p className="error">{historicalPrices.error.message}</p>
              ) : historicalPrices.data.length === 0 ? (
                <p className="history-page__empty">Stored market data is no longer available for this bet.</p>
              ) : (
                <PriceChart prices={historicalPrices.data} bet={selectedBet} staticHistory />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <h1>Login required</h1>
          <p className="identity">Log in from the market page to see your prediction history.</p>
          <Link to="/" className="text-link">Return to market</Link>
        </>
      )}
    </section>
  );
}
