import assert from "node:assert/strict";
import test from "node:test";

import type { LivePricePublisher } from "./livePricePublisher.js";
import {
  MarketPriceProcessor,
  type Logger,
} from "./marketPriceProcessor.js";
import type { PriceHistoryRepository } from "./priceHistoryWriter.js";
import type { MarketPriceEventData } from "./types.js";

function marketPrice(
  price: string,
  eventTimestamp: string,
): MarketPriceEventData {
  return {
    product: "BTC-USD",
    price,
    eventTimestamp,
    receivedTimestamp: eventTimestamp,
  };
}

class FakeRepository implements PriceHistoryRepository {
  public readonly writes: MarketPriceEventData[] = [];
  public failure: Error | undefined;
  public waitForWrite: Promise<void> | undefined;

  public async getLatestSourceTimestamp(): Promise<string | undefined> {
    return undefined;
  }

  public async put(value: MarketPriceEventData): Promise<void> {
    await this.waitForWrite;
    if (this.failure) throw this.failure;
    this.writes.push(value);
  }
}

class FakePublisher implements LivePricePublisher {
  public readonly published: MarketPriceEventData[] = [];
  public failure: Error | undefined;

  public async publish(value: MarketPriceEventData): Promise<void> {
    if (this.failure) throw this.failure;
    this.published.push(value);
  }
}

interface LogEntry {
  level: string;
  event: string;
}

async function createProcessor(
  repository = new FakeRepository(),
  publisher = new FakePublisher(),
) {
  const logs: LogEntry[] = [];
  const log: Logger = (level, event) => logs.push({ level, event });
  const processor = await MarketPriceProcessor.create({
    product: "BTC-USD",
    repository,
    livePricePublisher: publisher,
    log,
  });
  return { processor, repository, publisher, logs };
}

test("rejects out-of-order events before persistence", async () => {
  const { processor, repository } = await createProcessor();
  processor.process(marketPrice("100", "2026-08-19T10:00:01.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.000Z"));
  await processor.stop();

  assert.deepEqual(repository.writes.map((value) => value.price), ["100"]);
});

test("passes accepted events to history and publishes stored points", async () => {
  const { processor, repository, publisher } = await createProcessor();
  const value = marketPrice("100", "2026-08-19T10:00:00.000Z");
  processor.process(value);
  await processor.stop();

  assert.deepEqual(repository.writes, [value]);
  assert.deepEqual(publisher.published, [value]);
});

test("does not publish a point skipped by the history sampler", async () => {
  const { processor, publisher } = await createProcessor();
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.500Z"));
  await processor.stop();

  assert.deepEqual(publisher.published.map((value) => value.price), ["100"]);
});

test("history failure is recorded and prevents live publishing", async () => {
  const repository = new FakeRepository();
  repository.failure = new Error("DynamoDB failed");
  const { processor, publisher, logs } = await createProcessor(repository);
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  await processor.stop();

  assert.equal(processor.historyWriteFailed, true);
  assert.equal(publisher.published.length, 0);
  assert.ok(logs.some(({ level, event }) => level === "error" && event === "price_history_write_failed"));
});

test("live-publish failure is handled without marking history failed", async () => {
  const publisher = new FakePublisher();
  publisher.failure = new Error("AppSync failed");
  const { processor, logs } = await createProcessor(
    new FakeRepository(),
    publisher,
  );
  let unhandled: unknown;
  const onUnhandled = (error: unknown) => {
    unhandled = error;
  };
  process.once("unhandledRejection", onUnhandled);

  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  await processor.stop();
  await new Promise<void>((resolve) => setImmediate(resolve));
  process.removeListener("unhandledRejection", onUnhandled);

  assert.equal(unhandled, undefined);
  assert.equal(processor.historyWriteFailed, false);
  assert.ok(logs.some(({ level, event }) => level === "warn" && event === "live_price_publish_failed"));
});

test("stop waits for in-flight processing", async () => {
  const repository = new FakeRepository();
  let releaseWrite!: () => void;
  repository.waitForWrite = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const { processor } = await createProcessor(repository);
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));

  let stopped = false;
  const stopping = processor.stop().then(() => {
    stopped = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(stopped, false);

  releaseWrite();
  await stopping;
  assert.equal(stopped, true);
});
