export interface MarketPriceEventData {
  product: "BTC-USD";
  price: string;
  eventTimestamp: string;
  receivedTimestamp: string;
  sequence?: number;
  tradeId?: number;
}

export interface LiveMarketPrice {
  price: string;
  eventTimestamp: string;
}

export interface PricePublisher {
  publish(marketPrice: LiveMarketPrice): Promise<void>;
}
