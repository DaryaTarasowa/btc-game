import { useQuery } from "@tanstack/react-query";
import { BET_CHART_PADDING_MS, betChartWindow, type ResolvedBet } from "@/api/bets";
import { getRecentPrices } from "@/api/prices";

export function useResolvedBetChart(bet: ResolvedBet | null) {
  return useQuery({
    queryKey: ["prices", "bet", bet?.betId],
    queryFn: ({ signal }) => getRecentPrices({ product: bet!.product, ...betChartWindow(bet!), signal }),
    enabled: Boolean(bet),
    refetchInterval: bet && Date.now() < Date.parse(bet.endEventTimestamp) + BET_CHART_PADDING_MS
      ? 1_000
      : false,
  });
}
