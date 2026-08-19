import { useQuery } from "@tanstack/react-query";
import { getRecentPrices } from "../api/prices";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { subscribeToLivePrices } from "../api/livePrices";
import type { MarketPrice } from "../api/prices";

const recentPricesQueryKey = ["prices", "recent"] as const;

export function useRecentPrices() {
  return useQuery({
    queryKey: recentPricesQueryKey,
    queryFn: getRecentPrices,
  });
}

export function useLivePrices() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void subscribeToLivePrices((price) => {
      queryClient.setQueryData<MarketPrice[]>(
        recentPricesQueryKey,
        (current = []) => {
          const cutoff = Date.now() - 3 * 60_000;

          return [...current, price].filter(
            (item) => Date.parse(item.eventTimestamp) >= cutoff,
          );
        },
      );
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);
}
