import { CoinbasePriceConsumer } from "./coinbasePriceConsumer.js";
import { AppsyncEventsPublisher } from "./appsyncEventsPublisher.js";
import { MarketPriceProcessor } from "./marketPriceProcessor.js";
import { PriceHistoryRepository } from "./priceHistoryRepository.js";
import { log } from "./utils.js";
import { BetRepository } from "./betRepository.js";
import { BetResolver } from "./betResolver.js";

interface StartConfig {
  products: string[];
  coinbaseChannels: string[];
  livePriceChannelPrefix: string;
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
  const products = process.env.MARKET_PRODUCTS?.split(",").map((product) => product.trim()).filter(Boolean);
  const livePriceChannelPrefix = process.env.APPSYNC_EVENTS_CHANNEL_PREFIX;
  const coinbaseChannels = process.env.COINBASE_CHANNELS?.split(",").map((channel) => channel.trim()).filter(Boolean);

  if (!priceHistoryTable || !appsyncEventsEndpoint || !betsTable || !playersTable || !products?.length || !livePriceChannelPrefix || !coinbaseChannels?.length) {
    throw new Error("Missing required environment configuration.");
  }

  return {
    products,
    coinbaseChannels,
    livePriceChannelPrefix,
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
    const livePricePublisher = new AppsyncEventsPublisher(config.appsyncEventsEndpoint, config.livePriceChannelPrefix);
    const betResolver = new BetResolver(
      new BetRepository(config.betsTable, config.playersTable),
      log,
    );
    await betResolver.start();
    const processors = new Map(await Promise.all(config.products.map(async (product) => [product, await MarketPriceProcessor.create({ repository, livePricePublisher, betResolver, product, log })] as const)));
    const consumer = new CoinbasePriceConsumer(config.products, config.coinbaseChannels, log, (message) => processors.get(message.product)?.process(message));

    log("info", "price_history_initialized", { products: config.products });

    let stopping = false;
    async function shutdown(signal: NodeJS.Signals): Promise<void> {
      if (stopping) return;
      stopping = true;

      log("info", "shutdown", { signal });
      consumer.stop();
      await Promise.all([...processors.values()].map((processor) => processor.stop()));

      if ([...processors.values()].some((processor) => processor.historyWriteFailed)) process.exitCode = 1;
    }

    process.once("SIGINT", (signal) => void shutdown(signal));
    process.once("SIGTERM", (signal) => void shutdown(signal));
    consumer.start();
  } catch (error: unknown) {
    log("error", "price_history_initialization_failed", {
      products: config.products,
      message:
        error instanceof Error ? error.message : "Unknown DynamoDB error",
    });
    process.exitCode = 1;
  }
}
