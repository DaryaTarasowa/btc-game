import { CoinbasePriceConsumer } from "./coinbasePriceConsumer.js";
import { LivePricePublisher } from "./livePricePublisher.js";
import { MarketPriceProcessor } from "./marketPriceProcessor.js";
import { PriceHistoryRepository } from "./priceHistoryRepository.js";
import { log } from "./utils.js";

const PRODUCT = "BTC-USD";

interface StartConfig {
  priceHistoryTable: string;
  livePriceEventEndpoint: string;
}

function getConfig(): StartConfig {
  const priceHistoryTable = process.env.PRICE_HISTORY_TABLE;
  const livePriceEventEndpoint = process.env.LIVE_PRICE_EVENT_ENDPOINT;

  if (!priceHistoryTable || !livePriceEventEndpoint) {
    throw new Error("Missing required environment configuration.");
  }

  return {
    priceHistoryTable,
    livePriceEventEndpoint,
  };
}

try {
  const config = getConfig();
  void start(config);
} catch (error) {
  log("error", "configuration_error", {
    message:
      error instanceof Error ? error.message : "Unknown configuration error",
  });

  process.exitCode = 1;
}

async function start(config: StartConfig): Promise<void> {
  try {
    const repository = new PriceHistoryRepository(config.priceHistoryTable);
    const livePricePublisher = new LivePricePublisher(
      config.livePriceEventEndpoint,
    );
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
