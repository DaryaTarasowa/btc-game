import { CoinbasePriceConsumer } from "./coinbase-client.js";
import type { LogLevel } from "./types.js";

function log(level: LogLevel, event: string, details: Record<string, unknown> = {}): void {
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

const consumer = new CoinbasePriceConsumer(log);

function shutdown(signal: NodeJS.Signals): void {
  log("info", "shutdown", { signal });
  consumer.stop();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

consumer.start();
