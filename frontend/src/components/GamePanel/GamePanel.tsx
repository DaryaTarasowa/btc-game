import { useEffect, useRef, useState } from "react";
import { GameControls } from "@/components/GamePanel/GameControls";
import { usePlayer } from "@/context/usePlayer";
import { BetDirection } from "@/domain/bets";
import { useBetCountdown } from "@/hooks/useBetCountdown";
import { usePlayerScore } from "@/hooks/usePlayerScore";
import { Link } from "@tanstack/react-router";
import { InfoModal } from "@/components/GamePanel/InfoModal";

import { cardStyle, accentCardStyle, sectionHeaderStyle } from "@/styles/ui";
import { useGameSession } from "@/context/useGameSession";

export function GamePanel() {
  const { playerId } = usePlayer();
  const {
    activeBet,
    betCreationError: creationError,
    isBetCreating: isCreating,
    isBetRecovering: isRecovering,
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

  const [infoModalOpen, setInfoModalOpen] = useState(false);

  return (
    <>
      {!activeBet ? (
        <div>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setInfoModalOpen(true)}
              className="text-sm font-medium text-muted underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white/70 mb-0 cursor-pointer"
            >
              How to play
            </button>
          </div>

          <div className={sectionHeaderStyle}>Place your call</div>
        </div>
      ) : (
        <div className={`${sectionHeaderStyle}`}>Wait for resolution</div>
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
          className={`${cardStyle} ${activeBet.direction === BetDirection.Up ? "border-up/40 text-up" : "border-down/40 text-down"} bg-ink`}
        >
          <span
            className={`text-xs ${activeBet.direction === BetDirection.Up ? "text-up" : "text-down"} tracking-[0.12em] uppercase font-extrabold`}
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
      {creationError && <p className="mt-5.5 text-danger">{creationError}</p>}

      {infoModalOpen && <InfoModal onClose={() => setInfoModalOpen(false)} />}
    </>
  );
}
