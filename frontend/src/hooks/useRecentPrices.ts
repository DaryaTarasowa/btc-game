import { useQuery } from "@tanstack/react-query";
import { getRecentPrices } from "@/api/prices";
import { useMarket } from "@/context/useMarket";
import { queryKeys } from "@/queryKeys";

export function useRecentPrices() {
  const { product } = useMarket();
  return useQuery({
    queryKey: queryKeys.recentPrices(product),
    queryFn: ({ signal }) => getRecentPrices({ product, signal }),
  });
}
