export interface NormalizedPriceUpdate {
  type: "price_update";
  source: "coinbase";
  product: "BTC-USD";
  price: string;
  sourceTimestamp: string;
  receivedTimestamp: string;
  sequence?: number;
  tradeId?: number;
}

export type LogLevel = "info" | "warn" | "error";
