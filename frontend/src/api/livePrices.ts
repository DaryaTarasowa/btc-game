import { events } from "@aws-amplify/api";
import type { MarketPrice } from "@/api/prices";
import { marketConfig } from "@/config/market";

export async function subscribeToLivePrices(
  product: string,
  onPrice: (price: MarketPrice) => void,
): Promise<() => void> {
  const channelPath = `${marketConfig.livePriceChannelPrefix.replace(/\/$/, "")}/${product}`;
  const channel = await events.connect(channelPath);

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
