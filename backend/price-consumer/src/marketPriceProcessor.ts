import type { PricePublisher } from "./types.js";
import { MarketPriceGuard } from "./marketPriceGuard.js";
import {
  PriceHistoryWriter,
  type PriceHistoryRepository,
} from "./priceHistoryWriter.js";
import type { MarketPriceEventData } from "./types.js";
import type { LogLevel } from "./utils.js";
import {
  MarketPriceGuardResult,
  MarketPriceProcessingResult,
} from "./domain.js";

export interface MarketBetResolver {
  process(marketPrice: MarketPriceEventData): boolean;
  stop(): Promise<void>;
}

export type Logger = (
  //TODO: move to utils.ts and reuse in all places where logging is needed
  level: LogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

export interface MarketPriceProcessorSettings {
  product: string;
  repository: PriceHistoryRepository;
  livePricePublisher: PricePublisher;
  betResolver: MarketBetResolver;
  log: Logger;
}

export class MarketPriceProcessor {
  private readonly guard = new MarketPriceGuard();
  private readonly pending = new Set<Promise<void>>();
  private nonIncreasingEventTimestamps = 0;
  private stopping = false;
  private writeFailed = false;

  private constructor(
    private readonly writer: PriceHistoryWriter,
    private readonly livePricePublisher: PricePublisher,
    private readonly betResolver: MarketBetResolver,
    private readonly log: Logger,
  ) {}

  public static async create({
    product,
    repository,
    livePricePublisher,
    betResolver,
    log,
  }: MarketPriceProcessorSettings): Promise<MarketPriceProcessor> {
    const writer = await PriceHistoryWriter.create({ product, repository });
    return new MarketPriceProcessor(
      writer,
      livePricePublisher,
      betResolver,
      log,
    );
  }

  public get historyWriteFailed(): boolean {
    return this.writeFailed;
  }

  public process(marketPrice: MarketPriceEventData): void {
    if (this.stopping) return;

    const guardResult = this.guard.evaluate(marketPrice);
    if (guardResult !== MarketPriceGuardResult.Accepted) {
      if (guardResult === MarketPriceGuardResult.NonIncreasingEventTimestamp) {
        this.logNonIncreasingEventTimestamp(marketPrice);
        return;
      }
    }

    const resolutionScheduled = this.betResolver.process(marketPrice);
    if (
      guardResult === MarketPriceGuardResult.UnchangedPrice &&
      !resolutionScheduled
    )
      return; // we still process events used for bet resolution

    const processing = this.processAccepted(marketPrice, resolutionScheduled);
    this.pending.add(processing);
    void processing.finally(() => this.pending.delete(processing));
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    await Promise.all([Promise.all(this.pending), this.betResolver.stop()]);
  }

  private async processAccepted(
    marketPrice: MarketPriceEventData,
    forceHistoryWrite = false,
  ): Promise<void> {
    let result: MarketPriceProcessingResult;

    try {
      result = await this.writer.process(marketPrice, forceHistoryWrite);
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

    if (result === MarketPriceProcessingResult.Skipped) return;

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

  // Log only the first and every 100th timestamp-order violation.
  private logNonIncreasingEventTimestamp(
    marketPrice: MarketPriceEventData,
  ): void {
    this.nonIncreasingEventTimestamps += 1;
    if (
      this.nonIncreasingEventTimestamps !== 1 &&
      this.nonIncreasingEventTimestamps % 100 !== 0
    ) {
      return;
    }

    this.log("warn", "market_event_dropped", {
      reason: MarketPriceGuardResult.NonIncreasingEventTimestamp,
      product: marketPrice.product,
      eventTimestamp: marketPrice.eventTimestamp,
      droppedCount: this.nonIncreasingEventTimestamps,
    });
  }
}
