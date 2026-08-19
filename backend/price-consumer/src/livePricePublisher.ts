import { PublishRequest } from "ob-appsync-events-request";

export interface LiveMarketPrice {
  price: string;
  eventTimestamp: string;
}

const CHANNEL = "/prices/BTC-USD";

export class LivePricePublisher {
  public constructor(private readonly endpoint: string) {}

  public async publish(marketPrice: LiveMarketPrice): Promise<void> {
    const request = await PublishRequest.signed(
      this.endpoint,
      CHANNEL,
      marketPrice,
    );

    const response = await fetch(request);

    if (!response.ok) {
      throw new Error(`AppSync publish failed with status ${response.status}.`);
    }
  }
}
