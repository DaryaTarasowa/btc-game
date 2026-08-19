import { useEffect, useState } from "react";
import { GameControls } from "../components/GameControls/GameControls";
import { LoginButton } from "../components/LoginButton/LoginButton";
import { PriceChart } from "../components/PriceChart/PriceChart";
import { usePlayer } from "../context/usePlayer";
import { useLivePrices, useRecentPrices } from "../queries/useRecentPrices";
import { useCreateBet } from "../queries/useCreateBet";
import { useStoredActiveBet } from "../queries/useStoredActiveBet";

function useBetCountdown(targetTimestamp?: string) {
  const [, redraw] = useState(0);

  useEffect(() => {
    if (!targetTimestamp) return;
    const timer = window.setInterval(() => redraw((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [targetTimestamp]);

  return targetTimestamp
    ? Math.max(0, Math.ceil((Date.parse(targetTimestamp) - Date.now()) / 1_000))
    : 0;
}

export function GamePage() {
  const { playerId } = usePlayer();
  const recentPrices = useRecentPrices();
  useLivePrices();
  const prices = recentPrices.data ?? [];
  const latestVisiblePoint = prices.at(-1);
  const [activeBet, setActiveBet] = useStoredActiveBet(playerId);
  const createBet = useCreateBet(setActiveBet);
  const secondsRemaining = useBetCountdown(activeBet?.resolutionTargetTimestamp);

  return (
    <div className="game-page">
      <section className="player-panel">
        <p className="eyebrow">PLAYER</p>
        <h1>{playerId ? "Place your call" : "Ready to play?"}</h1>
        {playerId ? (
          <p className="identity">
            Signed in as <strong>{playerId}</strong>
          </p>
        ) : (
          <LoginButton />
        )}
        {activeBet && (
          <div className={`active-bet active-bet--${activeBet.direction}`}>
            <span>{activeBet.direction.toUpperCase()} BET ACTIVE</span>
            <strong>{secondsRemaining}s</strong>
            <small>
              Started at ${Number(activeBet.startPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </small>
          </div>
        )}
        <GameControls
          disabled={!playerId || !latestVisiblePoint || createBet.isPending || Boolean(activeBet)}
          onChoose={(direction) => {
            if (!playerId || !latestVisiblePoint) return;
            createBet.mutate({ playerId, direction, point: latestVisiblePoint });
          }}
        />
        {createBet.isError && <p className="error">{createBet.error.message}</p>}
      </section>
      <div className="market-panel" aria-live="polite">
        {recentPrices.isPending ? (
          <div className="market-state">
            <span className="market-state__pulse" aria-hidden="true" />
            <strong>Loading BTC market history</strong>
            <span>Reading the latest stored trades…</span>
          </div>
        ) : recentPrices.isError ? (
          <div className="market-state market-state--error">
            <strong>Market data unavailable</strong>
            <span>{recentPrices.error.message}</span>
          </div>
        ) : prices.length === 0 ? (
          <div className="market-state">
            <strong>No recent BTC prices</strong>
            <span>
              The market feed has not stored any trades in the last 3 minutes.
            </span>
          </div>
        ) : (
          <PriceChart prices={prices} activeBet={activeBet} />
        )}
      </div>
    </div>
  );
}
