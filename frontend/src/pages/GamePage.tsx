import { GameControls } from "../components/GameControls/GameControls";
import { LoginButton } from "../components/LoginButton/LoginButton";
import { PriceChart } from "../components/PriceChart/PriceChart";
import { usePlayer } from "../context/usePlayer";
import { useRecentPrices } from "../queries/useRecentPrices";

export function GamePage() {
  const { playerId } = usePlayer();
  const recentPrices = useRecentPrices();
  const prices = recentPrices.data ?? [];

  return (
    <div className="game-page">
      <section className="player-panel">
        <p className="eyebrow">PLAYER</p>
        <h1>{playerId ? "Place your call" : "Ready to play?"}</h1>
        {playerId ? (
          <p className="identity">Signed in as <strong>{playerId}</strong></p>
        ) : (
          <LoginButton />
        )}
        <GameControls />
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
            <span>The market feed has not stored any trades in the last 10 minutes.</span>
          </div>
        ) : (
          <PriceChart prices={prices} />
        )}
      </div>
    </div>
  );
}
