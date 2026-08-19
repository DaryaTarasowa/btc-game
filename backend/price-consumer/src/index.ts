import { CoinbasePriceConsumer } from "./coinbasePriceConsumer.js";
import { AppSyncLivePricePublisher } from "./livePricePublisher.js";
import { MarketPriceProcessor } from "./marketPriceProcessor.js";
import { PriceHistoryRepository } from "./PriceHistoryRepository.js";
import { log } from "./utils.js";

const PRODUCT = "BTC-USD";
const tableName = process.env.PRICE_HISTORY_TABLE;

if (!tableName) {
  log("error", "configuration_error", {
    missingEnvironmentVariable: "PRICE_HISTORY_TABLE",
  });
  process.exitCode = 1;
} else {
  void start(tableName);
}

async function start(priceHistoryTable: string): Promise<void> {
  try {
    const repository = new PriceHistoryRepository(priceHistoryTable);
    const livePricePublisher = new AppSyncLivePricePublisher();
    const processor = await MarketPriceProcessor.create({
      repository,
      livePricePublisher,
      product: PRODUCT,
      log,
    });
    const consumer = new CoinbasePriceConsumer(log, (message) =>
      processor.process(message),
    );

    log("info", "price_history_initialized", { product: PRODUCT });

    let stopping = false;
    async function shutdown(signal: NodeJS.Signals): Promise<void> {
      if (stopping) return;
      stopping = true;

      log("info", "shutdown", { signal });
      consumer.stop();
      await processor.stop();

      if (processor.historyWriteFailed) process.exitCode = 1;
    }

    process.once("SIGINT", (signal) => void shutdown(signal));
    process.once("SIGTERM", (signal) => void shutdown(signal));
    consumer.start();
  } catch (error: unknown) {
    log("error", "price_history_initialization_failed", {
      product: PRODUCT,
      message:
        error instanceof Error ? error.message : "Unknown DynamoDB error",
    });
    process.exitCode = 1;
  }
}
