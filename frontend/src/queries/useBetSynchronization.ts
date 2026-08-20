import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BetNotFoundError, getBet, type ActiveBet, type BetStatus, type ResolvedBet } from "@/api/bets";

export const betStatusQueryKey = (playerId: string, betId: string) => ["bets", playerId, betId] as const;

export function millisecondsUntilTarget(bet: ActiveBet, now = Date.now()) { return Math.max(0, Date.parse(bet.resolutionTargetTimestamp) - now); }
export function statusRefetchInterval(status: BetStatus | undefined, targetReached: boolean) { return targetReached && status?.status === "active" ? 1_000 : false; }
export function statusStaleTime(status: BetStatus | undefined) { return status?.status === "active" ? millisecondsUntilTarget(status) : Infinity; }

export function useBetSynchronization(playerId: string | null, persistedActiveBetId?: string) {
  const queryClient = useQueryClient();
  const [betId, setBetId] = useState<string | null>(persistedActiveBetId ?? null);
  const [resolvedBet, setResolvedBet] = useState<ResolvedBet | null>(null);
  const [targetReached, setTargetReached] = useState(false);

  useEffect(() => { setBetId(persistedActiveBetId ?? null); setResolvedBet(null); setTargetReached(false); }, [playerId, persistedActiveBetId]);

  const query = useQuery({
    queryKey: playerId && betId ? betStatusQueryKey(playerId, betId) : ["bets", "idle"],
    queryFn: ({ signal }) => getBet(betId!, signal),
    enabled: Boolean(playerId && betId),
    staleTime: ({ state }) => statusStaleTime(state.data),
    refetchInterval: ({ state }) => statusRefetchInterval(state.data, targetReached),
  });

  useEffect(() => {
    if (query.data?.status !== "active") return;
    const delay = millisecondsUntilTarget(query.data);
    if (delay === 0) { setTargetReached(true); return; }
    const timer = window.setTimeout(() => { setTargetReached(true); void query.refetch(); }, delay);
    return () => window.clearTimeout(timer);
  }, [query.data, query.refetch]);

  useEffect(() => {
    if (!playerId || query.data?.status !== "resolved") return;
    setResolvedBet(query.data); setBetId(null); setTargetReached(false);
    void queryClient.invalidateQueries({ queryKey: ["player", playerId] });
  }, [playerId, query.data, queryClient]);

  useEffect(() => {
    if (!playerId || !(query.error instanceof BetNotFoundError)) return;
    setBetId(null);
  }, [playerId, query.error]);

  const trackCreatedBet = useCallback((bet: ActiveBet) => {
    if (!playerId) return;
    queryClient.setQueryData(betStatusQueryKey(playerId, bet.betId), bet);
    setResolvedBet(null); setTargetReached(false); setBetId(bet.betId);
  }, [playerId, queryClient]);

  const activeBet = query.data?.status === "active" ? query.data as ActiveBet : null;
  return { activeBet, resolvedBet, isRecovering: Boolean(betId && query.isPending), trackCreatedBet };
}
