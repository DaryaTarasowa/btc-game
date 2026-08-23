import { events } from "@aws-amplify/api";
import { type MarketPrice, marketPriceSchema } from "@/api/prices";
import { marketConfig } from "@/config/market";

export async function subscribeToLivePrices(
  product: string,
  onPrice: (price: MarketPrice) => void,
): Promise<() => void> {
  const channelPath = `${marketConfig.livePriceChannelPrefix.replace(/\/$/, "")}/${product}`;
  const channel = await events.connect(channelPath);

  const subscription = channel.subscribe({
    next: (event) => {
      const parsed = marketPriceSchema.safeParse(event.event);

      if (!parsed.success) {
        console.error("Invalid live price event", parsed.error);
        return;
      }

      onPrice(parsed.data);
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
