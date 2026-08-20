import { events } from "@aws-amplify/api";
import type { MarketPrice } from "@/api/prices";

const CHANNEL = import.meta.env.VITE_APPSYNC_EVENTS_CHANNEL;

export async function subscribeToLivePrices(
  onPrice: (price: MarketPrice) => void,
): Promise<() => void> {
  const channel = await events.connect(CHANNEL);

  const subscription = channel.subscribe({
    next: (event) => {
      onPrice(event.event as MarketPrice);
    },
    error: (error) => {
      console.error("Live price subscription failed", error);
    },
  });

  return () => {
    subscription.unsubscribe();
    void channel.close();
  };
}
