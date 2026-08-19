import type { MarketPriceEventData } from "./types.js";
import { toEpochMilliseconds } from "./utils.js";

/**
 * Filters normalized market prices before they enter the application pipeline.
 *
 * A market price is skipped when:
 * - its event timestamp is not newer than the latest processed event; or
 * - its price is unchanged from the latest processed price.
 *
 * The event timestamp is advanced even for unchanged prices so that an older
 * event arriving later cannot be processed as a new market event.
 */
export class MarketPriceGuard {
  private latestEventTime: number | undefined;
  private latestPrice: string | undefined;

  public shouldSkip(marketPrice: MarketPriceEventData): boolean {
    const eventTime = toEpochMilliseconds(marketPrice.eventTimestamp);

    if (
      this.latestEventTime !== undefined &&
      eventTime <= this.latestEventTime
    ) {
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
