import type { PricePublisher } from "./livePricePublisher.js";
import { MarketPriceGuard } from "./marketPriceGuard.js";
import {
  PriceHistoryWriter,
  type PriceHistoryRepository,
} from "./priceHistoryWriter.js";
import type { MarketPriceEventData } from "./types.js";
import type { LogLevel } from "./utils.js";

export type Logger = (
  level: LogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

export interface MarketPriceProcessorSettings {
  product: "BTC-USD";
  repository: PriceHistoryRepository;
  livePricePublisher: PricePublisher;
  log: Logger;
}

export class MarketPriceProcessor {
  private readonly guard = new MarketPriceGuard();
  private readonly pending = new Set<Promise<void>>();
  private droppedMarketEvents = 0;
  private stopping = false;
  private writeFailed = false;

  private constructor(
    private readonly writer: PriceHistoryWriter,
    private readonly livePricePublisher: PricePublisher,
    private readonly log: Logger,
  ) {}

  public static async create({
    product,
    repository,
    livePricePublisher,
    log,
  }: MarketPriceProcessorSettings): Promise<MarketPriceProcessor> {
    const writer = await PriceHistoryWriter.create({ product, repository });
    return new MarketPriceProcessor(writer, livePricePublisher, log);
  }

  public get historyWriteFailed(): boolean {
    return this.writeFailed;
  }

  public process(marketPrice: MarketPriceEventData): void {
    if (this.stopping || this.guard.shouldSkip(marketPrice)) {
      if (!this.stopping) this.logDroppedEvent(marketPrice);
      return;
    }

    // The authoritative unsampled event remains available here for future bet resolution.
    const processing = this.processAccepted(marketPrice);
    this.pending.add(processing);
    void processing.finally(() => this.pending.delete(processing));
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    await Promise.all(this.pending);
  }

  private async processAccepted(
    marketPrice: MarketPriceEventData,
  ): Promise<void> {
    let result: "stored" | "skipped";

    try {
      result = await this.writer.process(marketPrice);
    } catch (error: unknown) {
      this.writeFailed = true;
      this.log("error", "price_history_write_failed", {
        product: marketPrice.product,
        sourceTimestamp: marketPrice.eventTimestamp,
        message:
          error instanceof Error ? error.message : "Unknown DynamoDB error",
      });
      return;
    }

    if (result === "skipped") return;

    try {
      await this.livePricePublisher.publish(marketPrice);
    } catch (error: unknown) {
      this.log("warn", "live_price_publish_failed", {
        product: marketPrice.product,
        sourceTimestamp: marketPrice.eventTimestamp,
        message:
          error instanceof Error ? error.message : "Unknown publish error",
      });
    }
  }

  // Log a warning for dropped market events, but only for the first and every 100th dropped event.
  private logDroppedEvent(marketPrice: MarketPriceEventData): void {
    this.droppedMarketEvents += 1;
    if (
      this.droppedMarketEvents !== 1 &&
      this.droppedMarketEvents % 100 !== 0
    ) {
      return;
    }

    this.log("warn", "market_event_dropped", {
      reason: "non_increasing_source_timestamp",
      product: marketPrice.product,
      sourceTimestamp: marketPrice.eventTimestamp,
      droppedCount: this.droppedMarketEvents,
    });
  }
}
