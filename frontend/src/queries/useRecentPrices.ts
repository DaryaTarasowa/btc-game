import { useQuery } from "@tanstack/react-query";
import { getRecentPrices } from "@/api/prices";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { subscribeToLivePrices } from "@/api/livePrices";
import type { MarketPrice } from "@/api/prices";
import { useMarket } from "@/context/useMarket";

const recentPricesQueryKey = (product: string) => ["prices", product, "recent"] as const;

export function appendRecentPrice(
  current: MarketPrice[],
  price: MarketPrice,
  now = Date.now(),
): MarketPrice[] {
  const cutoff = now - 3 * 60_000;
  return [...current, price].filter(
    (item) => Date.parse(item.eventTimestamp) >= cutoff,
  );
}

export function useRecentPrices() {
  const { product } = useMarket();
  return useQuery({
    queryKey: recentPricesQueryKey(product),
    queryFn: ({ signal }) => getRecentPrices({ product, signal }),
  });
}

export function useLivePrices() {
  const queryClient = useQueryClient();
  const { product } = useMarket();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void subscribeToLivePrices(product, (price) => {
      if (price.product !== product) return;
      queryClient.setQueryData<MarketPrice[]>(
        recentPricesQueryKey(product),
        (current = []) => appendRecentPrice(current, price),
      );
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      unsubscribe?.();
    };
  }, [product, queryClient]);
}
