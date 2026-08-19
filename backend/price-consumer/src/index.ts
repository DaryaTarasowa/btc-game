import { CoinbasePriceConsumer } from "./coinbaseClient.js";
import { DynamoDbPriceHistoryRepository } from "./priceHistory.js";
import { PriceHistoryWriter } from "./priceHistoryWriter.js";
import { MarketPriceGuard } from "./marketPriceGuard.js";
import type { LogLevel, MarketPriceEventData } from "./types.js";

function log(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

const tableName = process.env.PRICE_HISTORY_TABLE;
if (!tableName) {
  log("error", "configuration_error", {
    missingEnvironmentVariable: "PRICE_HISTORY_TABLE",
  });
  process.exitCode = 1;
} else {
  const repository = new DynamoDbPriceHistoryRepository(tableName);
  let historyWriter: PriceHistoryWriter;
  const dataFilter = new MarketPriceGuard();
  const pendingWrites = new Set<Promise<void>>();
  let writeFailed = false;
  let stopping = false;
  let droppedMarketEvents = 0;

  function processHistory(priceData: MarketPriceEventData): void {
    const pending = historyWriter.process(priceData).then(
      () => undefined, // happy path, nothing to do
      (error: unknown) => {
        writeFailed = true;
        log("error", "price_history_write_failed", {
          product: priceData.product,
          sourceTimestamp: priceData.eventTimestamp,
          message:
            error instanceof Error ? error.message : "Unknown DynamoDB error",
        });
      },
    );
    pendingWrites.add(pending);
    void pending.finally(() => pendingWrites.delete(pending));
  }

  function handlePriceUpdate(message: MarketPriceEventData): void {
    if (dataFilter.shouldSkip(message)) {
      droppedMarketEvents += 1;
      if (droppedMarketEvents === 1 || droppedMarketEvents % 100 === 0) {
        log("warn", "market_event_dropped", {
          reason: "non_increasing_source_timestamp",
          product: message.product,
          sourceTimestamp: message.eventTimestamp,
          droppedCount: droppedMarketEvents,
        });
      }
      return;
    }

    // The authoritative unsampled path remains available for future bet resolution.
    console.log(JSON.stringify(message));
    processHistory(message);
  }

  const consumer = new CoinbasePriceConsumer(log, handlePriceUpdate);

  async function start(): Promise<void> {
    try {
      historyWriter = await PriceHistoryWriter.create({
        repository,
        product: "BTC-USD",
      });
      log("info", "price_history_initialized", {
        product: "BTC-USD",
      });
      consumer.start();
    } catch (error: unknown) {
      log("error", "price_history_initialization_failed", {
        product: "BTC-USD",
        message:
          error instanceof Error ? error.message : "Unknown DynamoDB error",
      });
      process.exitCode = 1;
    }
  }

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (stopping) return;
    stopping = true;
    log("info", "shutdown", { signal });
    consumer.stop();
    await Promise.all(pendingWrites);
    if (writeFailed) process.exitCode = 1;
  }

  process.once("SIGINT", (signal) => void shutdown(signal));
  process.once("SIGTERM", (signal) => void shutdown(signal));
  void start();
}
