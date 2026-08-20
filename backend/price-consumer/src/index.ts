import { CoinbasePriceConsumer } from "./coinbasePriceConsumer.js";
import { AppsyncEventsPublisher } from "./appsyncEventsPublisher.js";
import { MarketPriceProcessor } from "./marketPriceProcessor.js";
import { PriceHistoryRepository } from "./priceHistoryRepository.js";
import { log } from "./utils.js";
import { BetRepository } from "./betRepository.js";
import { BetResolver } from "./betResolver.js";

const PRODUCT = "BTC-USD";

interface StartConfig {
  priceHistoryTable: string;
  appsyncEventsEndpoint: string;
  betsTable: string;
  playersTable: string;
}

function getConfig(): StartConfig {
  const priceHistoryTable = process.env.PRICE_HISTORY_TABLE;
  const appsyncEventsEndpoint = process.env.APPSYNC_EVENTS_ENDPOINT;
  const betsTable = process.env.BETS_TABLE;
  const playersTable = process.env.PLAYERS_TABLE;

  if (!priceHistoryTable || !appsyncEventsEndpoint || !betsTable || !playersTable) {
    throw new Error("Missing required environment configuration.");
  }

  return {
    priceHistoryTable,
    appsyncEventsEndpoint,
    betsTable,
    playersTable,
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
    const livePricePublisher = new AppsyncEventsPublisher(
      config.appsyncEventsEndpoint,
    );
    const betResolver = new BetResolver(
      new BetRepository(config.betsTable, config.playersTable),
      log,
    );
    await betResolver.start();
    const processor = await MarketPriceProcessor.create({
      repository,
      livePricePublisher,
      betResolver,
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
