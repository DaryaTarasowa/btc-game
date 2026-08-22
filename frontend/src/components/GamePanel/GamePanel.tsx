import { useEffect, useRef, useState } from "react";
import { GameControls } from "@/components/GamePanel/GameControls";
import { usePlayer } from "@/context/usePlayer";
import { BetDirection } from "@/domain/bets";
import { useBetCountdown } from "@/queries/useBetCountdown";
import { usePlayerScore } from "@/queries/usePlayerScore";

import {
  metricCardStyle,
  metricLabelStyle,
  metricValueStyle,
  pageTitleStyle,
} from "@/styles/ui";
import { useGameSession } from "../../context/useGameSession";

export function GamePanel() {
  const { playerId } = usePlayer();
  const {
    activeBet,
    creationError,
    isCreating,
    isRecovering,
    latestVisiblePoint,
    chooseDirection: onChoose,
  } = useGameSession();
  const secondsRemaining = useBetCountdown(
    activeBet?.resolutionTargetTimestamp,
  );
  const playerScore = usePlayerScore(playerId);
  const previousScoreRef = useRef<number | undefined>(undefined);
  const [scoreChanged, setScoreChanged] = useState(false);
  const score = playerScore.data?.score;

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

  return (
    <>
      <h1 className={pageTitleStyle}>Place your call</h1>
      <div
        className={`${metricCardStyle} mx-auto mb-6 -mt-2 border-accent/50 bg-[linear-gradient(145deg,rgba(247,147,26,0.2),rgba(247,147,26,0.06))] shadow[0_12px_32px_rgba(247,147,26,0.1)]`}
        aria-live="polite"
      >
        <span className={`${metricLabelStyle} text-[#ffc375]`}>
          Current score
        </span>
        <strong
          className={`${metricValueStyle} text-[clamp(2.6rem,6vw,4rem)] text-white`}
        >
          {score ?? "—"}
        </strong>
      </div>

      {activeBet && (
        <div
          className={`${metricCardStyle} mt-6.5 bg-[#080b12]/50 ${activeBet.direction === BetDirection.Up ? "border-success/40 text-success" : "border-error/40 text-error"}`}
        >
          <span className={metricLabelStyle}>
            {activeBet.direction.toUpperCase()} BET ACTIVE
          </span>
          <strong className={`${metricValueStyle} text-[2.4rem]`}>
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
          !latestVisiblePoint ||
          isRecovering ||
          isCreating ||
          Boolean(activeBet)
        }
        onChoose={onChoose}
      />
      {creationError && <p className="mt-5.5 text-down">{creationError}</p>}
    </>
  );
}
