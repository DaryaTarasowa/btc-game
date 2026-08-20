import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GameControls } from "@/components/GameControls/GameControls";
import { AccountPanel } from "@/components/AccountPanel/AccountPanel";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { usePlayer } from "@/context/usePlayer";
import { useLivePrices, useRecentPrices } from "@/queries/useRecentPrices";
import { useCreateBet } from "@/queries/useCreateBet";
import { useBetSynchronization } from "@/queries/useBetSynchronization";
import { usePlayerScore } from "@/queries/usePlayerScore";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";
import { BetDirection, BetResult } from "@/domain/bets";
import { useMarket } from "@/context/useMarket";
import { marketProductDisplayName } from "@/config/market";

const automaticallyPresentedBetIds = new Set<string>();

export function claimResolutionModal(betId: string, presentedBetIds = automaticallyPresentedBetIds) {
  if (presentedBetIds.has(betId)) return false;
  presentedBetIds.add(betId);
  return true;
}

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
  const { product } = useMarket();
  const productName = marketProductDisplayName(product);
  const recentPrices = useRecentPrices();
  useLivePrices();
  const prices = recentPrices.data ?? [];
  const latestVisiblePoint = prices.at(-1);
  const { activeBet, resolvedBet, isRecovering, trackCreatedBet } =
    useBetSynchronization(playerId, player?.activeBetId);
  const createBet = useCreateBet(trackCreatedBet);
  const secondsRemaining = useBetCountdown(
    activeBet?.resolutionTargetTimestamp,
  );
  const playerScore = usePlayerScore(playerId);
  const resolvedPrices = useResolvedBetChart(resolvedBet);
  const marketPanelRef = useRef<HTMLDivElement>(null);
  const previousScoreRef = useRef<number | undefined>(undefined);
  const [scoreChanged, setScoreChanged] = useState(false);
  const [openResolvedBetId, setOpenResolvedBetId] = useState<string | null>(
    null,
  );
  const [modalOrigin, setModalOrigin] = useState({ x: 0, y: 0 });
  const score = playerScore.data?.score;
  const modalOpen = Boolean(
    resolvedBet && openResolvedBetId === resolvedBet.betId,
  );
  const eyebrowClass =
    "mb-3 text-xs font-extrabold tracking-[0.22em] text-bitcoin";
  const marketStateClass =
    "grid min-h-[490px] place-content-center justify-items-center gap-2 rounded-3xl border border-white/10 bg-[#141927]/85 p-8 text-center text-[#8490a9] max-[820px]:min-h-80";

  useEffect(() => {
    if (score === undefined) return;
    if (
      previousScoreRef.current !== undefined &&
      previousScoreRef.current !== score
    ) {
      setScoreChanged(true);
      const timer = window.setTimeout(() => setScoreChanged(false), 700);
      previousScoreRef.current = score;
      return () => window.clearTimeout(timer);
    }
    previousScoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!resolvedBet || !claimResolutionModal(resolvedBet.betId)) return;
    const bounds = marketPanelRef.current?.getBoundingClientRect();
    setModalOrigin(
      bounds
        ? {
            x: bounds.left + bounds.width / 2 - window.innerWidth / 2,
            y: bounds.top + bounds.height / 2 - window.innerHeight / 2,
          }
        : { x: 0, y: 0 },
    );
    setOpenResolvedBetId(resolvedBet.betId);
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
    <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)] items-stretch gap-6 max-[820px]:grid-cols-1">
      <section className="rounded-3xl border border-white/10 bg-[#141927]/85 p-[clamp(28px,4vw,52px)] text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)] max-[820px]:text-left">
        <p className={eyebrowClass}>PLAYER</p>
        <h1 className="mb-7 text-[clamp(2rem,8vw,3.75rem)] leading-[0.98] tracking-[-0.045em]">
          {playerId ? "Place your call" : "Ready to play?"}
        </h1>
        {playerId ? (
          <>
            <div
              className="mx-auto mb-6 -mt-2 grid place-items-center gap-0.5 rounded-[18px] border border-bitcoin/50 bg-[linear-gradient(145deg,rgba(247,147,26,0.2),rgba(247,147,26,0.06))] px-5.5 py-3.5 shadow-[0_12px_32px_rgba(247,147,26,0.1)]"
              aria-live="polite"
            >
              <span className="text-[0.7rem] font-black tracking-[0.15em] text-[#ffc375] uppercase">
                Current score
              </span>
              <strong
                className={`text-[clamp(2.6rem,6vw,4rem)] leading-none text-white [font-variant-numeric:tabular-nums]${scoreChanged ? " motion-safe:animate-[score-change_700ms_cubic-bezier(0.2,0.8,0.2,1)]" : ""}`}
              >
                {score ?? "—"}
              </strong>
            </div>
            <p className="m-0 leading-7 text-slate-300">
              Signed in as{" "}
              <strong className="mt-2.5 block text-white [overflow-wrap:anywhere]">
                {player?.username}
              </strong>
              <small className="block">{player?.email}</small>
            </p>
            <AccountPanel />
          </>
        ) : (
          <AccountPanel />
        )}
        {activeBet && (
          <div
            className={`mt-6.5 grid gap-1.5 rounded-[18px] border bg-[#080b12]/50 p-4.5 ${activeBet.direction === BetDirection.Up ? "border-up/40 text-up" : "border-down/40 text-down"}`}
          >
            <span className="text-xs font-black tracking-[0.12em]">
              {activeBet.direction.toUpperCase()} BET ACTIVE
            </span>
            <strong className="text-[2.4rem] leading-none [font-variant-numeric:tabular-nums]">
              {secondsRemaining}s
            </strong>
            <small className="text-slate-400">
              Started at $
              {Number(activeBet.startPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </small>
          </div>
        )}
        <GameControls
          disabled={
            !playerId ||
            !latestVisiblePoint ||
            isRecovering ||
            createBet.isPending ||
            Boolean(activeBet)
          }
          onChoose={(direction) => {
            if (!playerId || !latestVisiblePoint) return;
            createBet.mutate({ direction, point: latestVisiblePoint });
          }}
        />
        {createBet.isError && (
          <p className="mt-5.5 text-down">{createBet.error.message}</p>
        )}
      </section>
      <div className="min-w-0" ref={marketPanelRef} aria-live="polite">
        {recentPrices.isPending ? (
          <div className={marketStateClass}>
            <span
              className="mb-1.5 size-[11px] rounded-full bg-bitcoin shadow-[0_0_0_0_rgba(247,147,26,0.5)] motion-safe:animate-[market-pulse_1.5s_infinite]"
              aria-hidden="true"
            />
            <strong className="text-slate-200">
              Loading {productName} market history
            </strong>
            <span>Reading the latest stored trades…</span>
          </div>
        ) : recentPrices.isError ? (
          <div className={`${marketStateClass} text-[#ff9b9b]`}>
            <strong>Market data unavailable</strong>
            <span>{recentPrices.error.message}</span>
          </div>
        ) : prices.length === 0 ? (
          <div className={marketStateClass}>
            <strong className="text-slate-200">No recent {productName} prices</strong>
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
          className="fixed inset-0 z-20 grid place-items-center bg-[#04060b]/80 p-6 backdrop-blur-lg motion-safe:animate-[resolution-backdrop-in_180ms_ease-out_both]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setOpenResolvedBetId(null);
          }}
        >
          <section
            className={`max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-auto rounded-[26px] border bg-[#111622] p-[clamp(16px,3vw,28px)] shadow-[0_28px_100px_rgba(0,0,0,0.7)] motion-safe:animate-[resolution-dialog-in_380ms_cubic-bezier(0.16,1,0.3,1)_both] ${resolvedBet.result === BetResult.Won ? "border-up/60" : "border-down/60"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolution-modal-title"
            style={
              {
                "--modal-origin-x": `${modalOrigin.x}px`,
                "--modal-origin-y": `${modalOrigin.y}px`,
              } as CSSProperties
            }
          >
            <header className="mb-4.5 flex items-start justify-between gap-5">
              <div>
                <p className={eyebrowClass}>BET RESOLVED</p>
                <h2
                  className={`m-0 text-[clamp(1.8rem,5vw,3.2rem)] leading-none ${resolvedBet.result === BetResult.Won ? "text-up" : "text-down"}`}
                  id="resolution-modal-title"
                >
                  {resolvedBet.result === BetResult.Won ? "You won +1" : "You lost −1"}
                </h2>
              </div>
              <button
                type="button"
                className="grid size-[42px] min-w-[42px] cursor-pointer place-items-center rounded-full border-0 bg-white/10 p-0 text-[1.7rem] font-extrabold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
                aria-label="Close resolved bet"
                autoFocus
                onClick={() => setOpenResolvedBetId(null)}
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
              <PriceChart
                prices={resolvedPrices.data}
                bet={resolvedBet}
                staticHistory
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
