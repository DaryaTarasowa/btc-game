import type { MarketPriceEventData } from "./types.js";
import { toEpochNanoseconds } from "./utils.js";
import { MarketPriceGuardResult } from "./domain.js";

/** Filters out non-increasing event timestamps and unchanged prices. */
export class MarketPriceGuard {
  private latestEventTime: bigint | undefined;
  private latestPrice: string | undefined;

  public evaluate(marketPrice: MarketPriceEventData): MarketPriceGuardResult {
    const eventTime = toEpochNanoseconds(marketPrice.eventTimestamp);
    if (
      this.latestEventTime !== undefined &&
      eventTime <= this.latestEventTime
    ) {
      return MarketPriceGuardResult.NonIncreasingEventTimestamp;
    }

    this.latestEventTime = eventTime;
    if (marketPrice.price === this.latestPrice) {
      return MarketPriceGuardResult.UnchangedPrice;
    }

    this.latestPrice = marketPrice.price;
    return MarketPriceGuardResult.Accepted;
  }
}
