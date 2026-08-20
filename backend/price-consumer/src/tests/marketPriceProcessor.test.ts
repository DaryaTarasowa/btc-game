import assert from "node:assert/strict";
import test from "node:test";

import type { PricePublisher } from "../types.js";
import {
  MarketPriceProcessor,
  type Logger,
  type MarketBetResolver,
} from "../marketPriceProcessor.js";
import type { PriceHistoryRepository } from "../priceHistoryWriter.js";
import type { MarketPriceEventData } from "../types.js";

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

class FakePublisher implements PricePublisher {
  public readonly published: MarketPriceEventData[] = [];
  public failure: Error | undefined;

  public async publish(value: MarketPriceEventData): Promise<void> {
    if (this.failure) throw this.failure;
    this.published.push(value);
  }
}

class FakeBetResolver implements MarketBetResolver {
  public readonly events: MarketPriceEventData[] = [];
  public stopped = false;
  public resolutionEventTimestamp: string | undefined;

  public process(value: MarketPriceEventData): boolean {
    this.events.push(value);
    return value.eventTimestamp === this.resolutionEventTimestamp;
  }

  public async stop(): Promise<void> {
    this.stopped = true;
  }
}

interface LogEntry {
  level: string;
  event: string;
  details?: Record<string, unknown>;
}

async function createProcessor(
  repository = new FakeRepository(),
  publisher = new FakePublisher(),
) {
  const logs: LogEntry[] = [];
  const betResolver = new FakeBetResolver();
  const log: Logger = (level, event, details) =>
    logs.push({ level, event, ...(details ? { details } : {}) });
  const processor = await MarketPriceProcessor.create({
    product: "BTC-USD",
    repository,
    livePricePublisher: publisher,
    betResolver,
    log,
  });
  return { processor, repository, publisher, betResolver, logs };
}

test("rejects out-of-order events before persistence", async () => {
  const { processor, repository, logs } = await createProcessor();
  processor.process(marketPrice("100", "2026-08-19T10:00:01.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.000Z"));
  await processor.stop();

  assert.deepEqual(
    repository.writes.map((value) => value.price),
    ["100"],
  );
  assert.deepEqual(logs, [
    {
      level: "warn",
      event: "market_event_dropped",
      details: {
        reason: "non_increasing_event_timestamp",
        product: "BTC-USD",
        eventTimestamp: "2026-08-19T10:00:00.000Z",
        droppedCount: 1,
      },
    },
  ]);
});

test("does not warn when a newer event has an unchanged price", async () => {
  const { processor, repository, betResolver, logs } = await createProcessor();
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  processor.process(marketPrice("100", "2026-08-19T10:00:01.000Z"));
  await processor.stop();

  assert.deepEqual(
    repository.writes.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:00.000Z"],
  );
  assert.deepEqual(logs, []);
  assert.deepEqual(
    betResolver.events.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:00.000Z", "2026-08-19T10:00:01.000Z"],
  );
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
  const { processor, publisher, betResolver } = await createProcessor();
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.500Z"));
  await processor.stop();

  assert.deepEqual(
    publisher.published.map((value) => value.price),
    ["100"],
  );
  assert.deepEqual(
    betResolver.events.map((value) => value.price),
    ["100", "101"],
  );
});

test("stores and publishes the exact event selected for bet resolution even inside the sampling interval", async () => {
  const { processor, repository, publisher, betResolver } = await createProcessor();
  betResolver.resolutionEventTimestamp = "2026-08-19T10:00:00.500Z";
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.500Z"));
  await processor.stop();

  assert.deepEqual(
    repository.writes.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:00.000Z", "2026-08-19T10:00:00.500Z"],
  );
  assert.deepEqual(
    publisher.published.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:00.000Z", "2026-08-19T10:00:00.500Z"],
  );
});

test("stores an unchanged-price event when that exact event is selected for resolution", async () => {
  const { processor, repository, betResolver } = await createProcessor();
  betResolver.resolutionEventTimestamp = "2026-08-19T10:00:00.500Z";
  processor.process(marketPrice("101", "2026-08-19T10:00:00.000Z"));
  processor.process(marketPrice("101", "2026-08-19T10:00:00.500Z"));
  await processor.stop();

  assert.deepEqual(
    repository.writes.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:00.000Z", "2026-08-19T10:00:00.500Z"],
  );
});

test("history failure is recorded and prevents live publishing", async () => {
  const repository = new FakeRepository();
  repository.failure = new Error("DynamoDB failed");
  const { processor, publisher, logs } = await createProcessor(repository);
  processor.process(marketPrice("100", "2026-08-19T10:00:00.000Z"));
  await processor.stop();

  assert.equal(processor.historyWriteFailed, true);
  assert.equal(publisher.published.length, 0);
  assert.ok(
    logs.some(
      ({ level, event }) =>
        level === "error" && event === "price_history_write_failed",
    ),
  );
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
  assert.ok(
    logs.some(
      ({ level, event }) =>
        level === "warn" && event === "live_price_publish_failed",
    ),
  );
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

test("raw unchanged events skipped by history still reach bet resolution", async () => {
  const { processor, repository, betResolver } = await createProcessor();
  processor.process(marketPrice("101", "2026-08-19T10:00:59.700Z"));
  processor.process(marketPrice("101", "2026-08-19T10:01:00.100Z"));
  await processor.stop();

  assert.deepEqual(
    repository.writes.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:59.700Z"],
  );
  assert.deepEqual(
    betResolver.events.map((value) => value.eventTimestamp),
    ["2026-08-19T10:00:59.700Z", "2026-08-19T10:01:00.100Z"],
  );
});
