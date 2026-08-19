import type { MarketPriceEventData } from "./types.js";
import { toEpochMilliseconds } from "./utils.js";

const MINIMUM_HISTORY_INTERVAL_MS = 1_000;

export interface PriceHistoryRepository {
  getLatestSourceTimestamp(product: string): Promise<string | undefined>;
  put(marketPrice: MarketPriceEventData): Promise<void>;
}

export type MarketPriceProcessingResult = "stored" | "skipped";

export interface PriceHistoryWriterSettings {
  product: string;
  repository: PriceHistoryRepository;
}

export class PriceHistoryWriter {
  private queue = Promise.resolve();

  private constructor(
    private readonly repository: PriceHistoryRepository,
    private lastStoredSourceTimestamp: string | undefined,
  ) {}

  public static async create({
    product,
    repository,
  }: PriceHistoryWriterSettings): Promise<PriceHistoryWriter> {
    const lastStoredSourceTimestamp =
      await repository.getLatestSourceTimestamp(product);
    return new PriceHistoryWriter(repository, lastStoredSourceTimestamp);
  }

  public process(
    marketPrice: MarketPriceEventData,
  ): Promise<MarketPriceProcessingResult> {
    const operation = this.queue.then(async () => {
      if (this.lastStoredSourceTimestamp) {
        const currentTime = toEpochMilliseconds(marketPrice.eventTimestamp);

        const lastStoredTime = toEpochMilliseconds(
          this.lastStoredSourceTimestamp,
        );

        if (currentTime < lastStoredTime + MINIMUM_HISTORY_INTERVAL_MS) {
          return "skipped";
        }
      }

      await this.repository.put(marketPrice);
      this.lastStoredSourceTimestamp = marketPrice.eventTimestamp;

      return "stored";
    });

    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }
}
