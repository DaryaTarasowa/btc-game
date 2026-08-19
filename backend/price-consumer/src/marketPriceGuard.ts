import type { MarketPriceEventData } from "./types.js";
import { toEpochNanoseconds } from "./utils.js";

export type MarketPriceGuardResult =
  | "accepted"
  | "non_increasing_event_timestamp"
  | "unchanged_price";

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
      return "non_increasing_event_timestamp";
    }

    this.latestEventTime = eventTime;
    if (marketPrice.price === this.latestPrice) {
      return "unchanged_price";
    }

    this.latestPrice = marketPrice.price;
    return "accepted";
  }
}
