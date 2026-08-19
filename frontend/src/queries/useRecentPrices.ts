import { useQuery } from "@tanstack/react-query";
import { getRecentPrices } from "../api/prices";

export const recentPricesQueryKey = ["prices", "recent"] as const;

export function useRecentPrices() {
  return useQuery({
    queryKey: recentPricesQueryKey,
    queryFn: ({ signal }) => getRecentPrices({ signal }),
    refetchOnWindowFocus: false,
  });
}
