export interface MarketPriceEventData {
  product: "BTC-USD";
  price: string;
  eventTimestamp: string;
  receivedTimestamp: string;
  sequence?: number;
  tradeId?: number;
}
