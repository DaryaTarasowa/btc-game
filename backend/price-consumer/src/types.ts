export interface MarketPriceEventData {
  product: string;
  price: string;
  eventTimestamp: string;
  receivedTimestamp: string;
  sequence?: number;
  tradeId?: number;
}

export interface LiveMarketPrice {
  product: string;
  price: string;
  eventTimestamp: string;
}

export interface PricePublisher {
  publish(marketPrice: LiveMarketPrice): Promise<void>;
}
