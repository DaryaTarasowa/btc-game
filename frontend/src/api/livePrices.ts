import { events } from "@aws-amplify/api";
import type { MarketPrice } from "./prices";

const CHANNEL = import.meta.env.VITE_APPSYNC_EVENTS_CHANNEL;

export async function subscribeToLivePrices(
  onPrice: (price: MarketPrice) => void,
): Promise<() => void> {
  console.log({
    endpoint: import.meta.env.VITE_APPSYNC_EVENTS_ENDPOINT,
    channel: import.meta.env.VITE_APPSYNC_EVENTS_CHANNEL,
    hasApiKey: Boolean(import.meta.env.VITE_APPSYNC_API_KEY),
  });
  const channel = await events.connect(CHANNEL);

  const subscription = channel.subscribe({
    next: (event) => {
      console.log("Received live price event:", event);
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
