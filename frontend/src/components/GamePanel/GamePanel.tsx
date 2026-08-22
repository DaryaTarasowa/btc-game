import { useEffect, useRef, useState } from "react";
import { GameControls } from "@/components/GamePanel/GameControls";
import { usePlayer } from "@/context/usePlayer";
import { BetDirection } from "@/domain/bets";
import { useBetCountdown } from "@/queries/useBetCountdown";
import { usePlayerScore } from "@/queries/usePlayerScore";
import { Link } from "@tanstack/react-router";

import { cardStyle, accentCardStyle, pageTitleStyle } from "@/styles/ui";
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
  const score = playerScore.data?.score;

  useEffect(() => {
    if (score === undefined) return;
    if (
      previousScoreRef.current !== undefined &&
      previousScoreRef.current !== score
    ) {
      previousScoreRef.current = score;
    }
    previousScoreRef.current = score;
  }, [score]);

  return (
    <>
      {!activeBet ? (
        <h1 className={`${pageTitleStyle} text-[clamp(2rem,8vw,3.75rem)]`}>
          Place your call
        </h1>
      ) : (
        <h2 className={`${pageTitleStyle} text-[clamp(1rem,4vw,2rem)]`}>
          Waiting for resolution...
        </h2>
      )}
      <Link
        to="/history"
        className={`${accentCardStyle} cursor-pointer hover:border-accent`}
      >
        <span
          className={`text-xs text-accent tracking-[0.12em] uppercase font-extrabold`}
        >
          Current score
        </span>
        <strong
          className={`block leading-none font-extrabold [font-variant-numeric:tabular-nums] text-[clamp(2.6rem,6vw,4rem)] text-white`}
        >
          {score ?? "—"}
        </strong>
      </Link>

      {activeBet && (
        <div
          className={`${cardStyle} ${activeBet.direction === BetDirection.Up ? "border-success/40 text-success" : "border-error/40 text-error"} bg-ink`}
        >
          <span
            className={`text-xs ${activeBet.direction === BetDirection.Up ? "text-success" : "text-error"} tracking-[0.12em] uppercase font-extrabold`}
          >
            {activeBet.direction.toUpperCase()} BET ACTIVE
          </span>
          <strong
            className={`block leading-none font-extrabold [font-variant-numeric:tabular-nums] text-[2.4rem]`}
          >
            {secondsRemaining}s
          </strong>
          <small className="text-muted">
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
      {creationError && <p className="mt-5.5 text-error">{creationError}</p>}
    </>
  );
}
