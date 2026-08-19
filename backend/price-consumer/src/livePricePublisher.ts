export interface LiveMarketPrice {
  price: string;
  eventTimestamp: string;
}
export interface LivePricePublisher {
  publish(marketPrice: LiveMarketPrice): Promise<void>;
}

export class AppSyncLivePricePublisher implements LivePricePublisher {
  publish(marketPrice: LiveMarketPrice): Promise<void> {
    return Promise.resolve();
  }
}
