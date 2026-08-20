import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { canReconstructBet, getCompletedBets, type ResolvedBet } from "../api/bets";
import { getRecentPrices } from "../api/prices";
import { PriceChart } from "../components/PriceChart/PriceChart";
import { usePlayer } from "../context/usePlayer";

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
  const selectedBet = history.data?.find((bet) => bet.id === selectedBetId) ?? null;
  const historicalPrices = useQuery({
    queryKey: ["prices", "bet", selectedBet?.id],
    queryFn: ({ signal }) => getRecentPrices({
      start: selectedBet!.startEventTimestamp,
      end: selectedBet!.endEventTimestamp,
      signal,
    }),
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
            <div className="history-list">
              {history.data.map((bet) => {
                const reconstructable = canReconstructBet(bet);
                return (
                  <button
                    type="button"
                    className={`history-bet history-bet--${bet.result}${selectedBetId === bet.id ? " history-bet--selected" : ""}`}
                    key={bet.id}
                    disabled={!reconstructable}
                    onClick={() => setSelectedBetId(bet.id)}
                    title={reconstructable ? "Reconstruct this bet chart" : "Chart data has expired after 10 hours"}
                  >
                    <span className="history-bet__result">{bet.result === "won" ? "+1 WON" : "−1 LOST"}</span>
                    <strong>{bet.direction.toUpperCase()} · ${Number(bet.startPrice).toLocaleString()}</strong>
                    <small>{dateFormatter.format(new Date(bet.startEventTimestamp))}</small>
                    {reconstructable && <span className="history-bet__chart" aria-label="Chart available">▥</span>}
                  </button>
                );
              })}
            </div>
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
                <PriceChart prices={historicalPrices.data} bet={selectedBet as ResolvedBet} staticHistory />
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
