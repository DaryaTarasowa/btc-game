import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BetNotFoundError,
  getBet,
  type ActiveBet,
  type ResolvedBet,
} from "@/api/bets";
import { BetStatus } from "@/domain/bets";

export const betStatusQueryKey = (playerId: string, betId: string) =>
  ["bets", playerId, betId] as const;

export function millisecondsUntilTarget(bet: ActiveBet, now = Date.now()) {
  return Math.max(0, Date.parse(bet.resolutionTargetTimestamp) - now);
}

/**
 * Keeps the frontend synchronized with the lifecycle of the player's active bet.
 *
 * Tracks a newly created or persisted active bet, waits until its resolution time,
 * then polls the backend until the bet is resolved and refreshes the player's score.
 */
export function useBetSynchronization(
  playerId: string | null,
  persistedActiveBetId?: string,
) {
  const queryClient = useQueryClient();

  const [betId, setBetId] = useState<string | null>(
    persistedActiveBetId ?? null,
  );
  const [resolvedBet, setResolvedBet] = useState<ResolvedBet | null>(null);
  const [isRecovering, setIsRecovering] = useState(
    Boolean(playerId && persistedActiveBetId),
  );
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setBetId(persistedActiveBetId ?? null);
    setResolvedBet(null);
    setIsRecovering(Boolean(playerId && persistedActiveBetId));
    setIsPolling(false);
  }, [playerId, persistedActiveBetId]);

  const query = useQuery({
    queryKey:
      playerId && betId ? betStatusQueryKey(playerId, betId) : ["bets", "idle"],

    queryFn: ({ signal }) => getBet(betId!, signal),

    enabled: Boolean(playerId && betId && (isRecovering || isPolling)),

    // If we're polling, keep checking once per second.
    refetchInterval: isPolling ? 1_000 : false,

    // A persisted bet must be checked against the backend after remount/login.
    refetchOnMount: "always",
  });

  // If the bet is still active, wait until its resolution time to start polling.
  useEffect(() => {
    if (query.data?.status !== BetStatus.Active) return;
    if (isRecovering && query.isFetching) return;

    const delay = millisecondsUntilTarget(query.data);
    setIsRecovering(false);

    if (delay === 0) {
      setIsPolling(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsPolling(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isRecovering, query.data, query.isFetching]);

  // If the bet has been resolved, store it and clear the active bet state.
  useEffect(() => {
    if (!playerId || query.data?.status !== BetStatus.Resolved) return;
    if (isRecovering && query.isFetching) return;

    setResolvedBet(query.data);
    setBetId(null);
    setIsRecovering(false);
    setIsPolling(false);

    void queryClient.invalidateQueries({
      queryKey: ["player", playerId],
    });
  }, [isRecovering, playerId, query.data, query.isFetching, queryClient]);

  useEffect(() => {
    if (!(query.error instanceof BetNotFoundError)) return;

    setBetId(null);
    setIsRecovering(false);
    setIsPolling(false);
  }, [query.error]);

  const trackCreatedBet = useCallback(
    (bet: ActiveBet) => {
      if (!playerId) return;

      queryClient.setQueryData(betStatusQueryKey(playerId, bet.betId), bet);

      setBetId(bet.betId);
      setResolvedBet(null);
      setIsRecovering(false);
      setIsPolling(false);
    },
    [playerId, queryClient],
  );

  const activeBet =
    !isRecovering && query.data?.status === BetStatus.Active
      ? query.data
      : null;

  return {
    activeBet,
    resolvedBet,
    isRecovering,
    trackCreatedBet,
  };
}
