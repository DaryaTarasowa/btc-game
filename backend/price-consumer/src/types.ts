export interface MarketPriceEventData {
  product: "BTC-USD";
  price: string;
  eventTimestamp: string;
  receivedTimestamp: string;
  sequence?: number;
  tradeId?: number;
}

export type LogLevel = "info" | "warn" | "error";
