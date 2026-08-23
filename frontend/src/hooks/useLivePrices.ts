import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useMarket } from "@/context/useMarket";
import { subscribeToLivePrices } from "@/api/livePrices";
import { queryKeys } from "@/queryKeys";
import { type MarketPrice } from "@/api/prices";

// Sacrificed efficiency for the readability/correctness. 3 minute window should work fine.
export function appendRecentPrice(
  current: MarketPrice[],
  price: MarketPrice,
  now = Date.now(),
): MarketPrice[] {
  const cutoff = now - 3 * 60_000;

  const recent = current.filter(
    (item) => Date.parse(item.eventTimestamp) >= cutoff,
  );

  const withoutDuplicate = recent.filter(
    (item) => item.eventTimestamp !== price.eventTimestamp,
  );

  return [...withoutDuplicate, price].sort(
    (left, right) =>
      Date.parse(left.eventTimestamp) - Date.parse(right.eventTimestamp),
  );
}

export function useLivePrices() {
  const queryClient = useQueryClient();
  const { product } = useMarket();

  const [connectionError, setConnectionError] = useState(false);
  const [connectionKey, setConnectionKey] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isDisposed = false;

    setConnectionError(false);

    void subscribeToLivePrices(product, (price) => {
      if (price.product !== product) return;

      queryClient.setQueryData<MarketPrice[]>(
        queryKeys.recentPrices(product),
        (current = []) => appendRecentPrice(current, price),
      );
    })
      .then((cleanup) => {
        if (isDisposed) {
          cleanup();
          return;
        }

        unsubscribe = cleanup;
      })
      .catch((error) => {
        if (isDisposed) return;

        console.error("Failed to subscribe to live prices", error);
        setConnectionError(true);
      });

    return () => {
      isDisposed = true;
      unsubscribe?.();
    };
  }, [product, queryClient, connectionKey]);

  const reconnect = useCallback(() => {
    setConnectionKey((key) => key + 1);
  }, []);

  return {
    connectionError,
    reconnect,
  };
}
