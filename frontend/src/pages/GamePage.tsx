import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GameControls } from "@/components/GameControls/GameControls";
import { LoginButton } from "@/components/LoginButton/LoginButton";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { usePlayer } from "@/context/usePlayer";
import { useLivePrices, useRecentPrices } from "@/queries/useRecentPrices";
import { useCreateBet } from "@/queries/useCreateBet";
import { useBetSynchronization } from "@/queries/useBetSynchronization";
import { usePlayerScore } from "@/queries/usePlayerScore";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";

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
  const { playerId, player } = usePlayer();
  const recentPrices = useRecentPrices();
  useLivePrices();
  const prices = recentPrices.data ?? [];
  const latestVisiblePoint = prices.at(-1);
  const { activeBet, resolvedBet, isRecovering, trackCreatedBet } = useBetSynchronization(playerId);
  const createBet = useCreateBet(trackCreatedBet);
  const secondsRemaining = useBetCountdown(activeBet?.resolutionTargetTimestamp);
  const playerScore = usePlayerScore(playerId);
  const resolvedPrices = useResolvedBetChart(resolvedBet);
  const marketPanelRef = useRef<HTMLDivElement>(null);
  const previousScoreRef = useRef<number | undefined>(undefined);
  const [scoreChanged, setScoreChanged] = useState(false);
  const [openResolvedBetId, setOpenResolvedBetId] = useState<string | null>(null);
  const [modalOrigin, setModalOrigin] = useState({ x: 0, y: 0 });
  const score = playerScore.data?.score;
  const modalOpen = Boolean(resolvedBet && openResolvedBetId === resolvedBet.id);

  useEffect(() => {
    if (score === undefined) return;
    if (previousScoreRef.current !== undefined && previousScoreRef.current !== score) {
      setScoreChanged(true);
      const timer = window.setTimeout(() => setScoreChanged(false), 700);
      previousScoreRef.current = score;
      return () => window.clearTimeout(timer);
    }
    previousScoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!resolvedBet) return;
    const bounds = marketPanelRef.current?.getBoundingClientRect();
    setModalOrigin(bounds ? {
      x: bounds.left + bounds.width / 2 - window.innerWidth / 2,
      y: bounds.top + bounds.height / 2 - window.innerHeight / 2,
    } : { x: 0, y: 0 });
    setOpenResolvedBetId(resolvedBet.id);
  }, [resolvedBet]);

  useEffect(() => {
    if (!modalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenResolvedBetId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen]);

  return (
    <div className="game-page">
      <section className="player-panel">
        <p className="eyebrow">PLAYER</p>
        <h1>{playerId ? "Place your call" : "Ready to play?"}</h1>
        {playerId ? (
          <>
          <div className={`player-score-card${scoreChanged ? " player-score-card--changed" : ""}`} aria-live="polite">
            <span>Current score</span>
            <strong>{score ?? "—"}</strong>
          </div>
          <p className="identity">
            Signed in as <strong>{player?.username}</strong>
            <small>{player?.email}</small>
          </p>
          <LoginButton />
          </>
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
          disabled={!playerId || !latestVisiblePoint || isRecovering || createBet.isPending || Boolean(activeBet)}
          onChoose={(direction) => {
            if (!playerId || !latestVisiblePoint) return;
            createBet.mutate({ direction, point: latestVisiblePoint });
          }}
        />
        {createBet.isError && <p className="error">{createBet.error.message}</p>}
      </section>
      <div className="market-panel" ref={marketPanelRef} aria-live="polite">
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
          <PriceChart prices={prices} bet={activeBet} />
        )}
      </div>
      {modalOpen && resolvedBet && (
        <div
          className="resolution-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenResolvedBetId(null);
          }}
        >
          <section
            className={`resolution-modal__dialog resolution-modal__dialog--${resolvedBet.result}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolution-modal-title"
            style={{
              "--modal-origin-x": `${modalOrigin.x}px`,
              "--modal-origin-y": `${modalOrigin.y}px`,
            } as CSSProperties}
          >
            <header className="resolution-modal__header">
              <div>
                <p className="eyebrow">BET RESOLVED</p>
                <h2 id="resolution-modal-title">
                  {resolvedBet.result === "won" ? "You won +1" : "You lost −1"}
                </h2>
              </div>
              <button
                type="button"
                className="resolution-modal__close"
                aria-label="Close resolved bet"
                autoFocus
                onClick={() => setOpenResolvedBetId(null)}
              >
                ×
              </button>
            </header>
            {resolvedPrices.isPending ? (
              <p className="resolution-modal__state">Reconstructing stored market window…</p>
            ) : resolvedPrices.isError ? (
              <p className="error">{resolvedPrices.error.message}</p>
            ) : resolvedPrices.data.length === 0 ? (
              <p className="resolution-modal__state">Stored market data is not available.</p>
            ) : (
              <PriceChart prices={resolvedPrices.data} bet={resolvedBet} staticHistory />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
