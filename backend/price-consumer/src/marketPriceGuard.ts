import type { MarketPriceEventData } from "./types.js";
import { toEpochMilliseconds } from "./utils.js";

/** Filters out non-increasing source timestamps and unchanged prices. */
export class MarketPriceGuard {
  private latestEventTime: number | undefined;
  private latestPrice: string | undefined;

  public shouldSkip(marketPrice: MarketPriceEventData): boolean {
    const eventTime = toEpochMilliseconds(marketPrice.eventTimestamp);
    if (this.latestEventTime !== undefined && eventTime <= this.latestEventTime) {
      return true;
    }

    this.latestEventTime = eventTime;
    if (marketPrice.price === this.latestPrice) {
      return true;
    }

    this.latestPrice = marketPrice.price;
    return false;
  }
}
