import assert from "node:assert/strict";
import test from "node:test";

import {
  PriceHistoryWriter,
  type PriceHistoryRepository,
} from "./priceHistoryWriter.js";
import type { MarketPriceEventData } from "./types.js";

const makeMarketPrice = (
  eventTimestamp: string,
  receivedTimestamp = eventTimestamp,
): MarketPriceEventData => ({
  product: "BTC-USD",
  price: eventTimestamp,
  eventTimestamp,
  receivedTimestamp,
});

class FakeRepository implements PriceHistoryRepository {
  public readonly writes: MarketPriceEventData[] = [];
  public failNextWrite = false;

  public constructor(public latest: string | undefined = undefined) {}

  public async getLatestSourceTimestamp(
    product: string,
  ): Promise<string | undefined> {
    assert.equal(product, "BTC-USD");
    return this.latest;
  }

  public async put(marketPrice: MarketPriceEventData): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("write failed");
    }

    this.writes.push(marketPrice);
  }
}

test("stores the first event when no previous history exists", async () => {
  const repository = new FakeRepository();
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:12.100Z")),
    "stored",
  );

  assert.equal(repository.writes.length, 1);
});

test("skips an event less than one second after the last stored event", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:13.099Z")),
    "skipped",
  );

  assert.equal(repository.writes.length, 0);
});

test("force-stores a resolution event inside the normal sampling interval", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:12.500Z"), true),
    "stored",
  );
  assert.deepEqual(
    repository.writes.map((point) => point.eventTimestamp),
    ["2026-08-18T18:30:12.500Z"],
  );

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:13.100Z")),
    "stored",
  );
  assert.deepEqual(
    repository.writes.map((point) => point.eventTimestamp),
    ["2026-08-18T18:30:12.500Z", "2026-08-18T18:30:13.100Z"],
  );
});

test("stores an event exactly one second after the last stored event", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:13.100Z")),
    "stored",
  );
});

test("stores an event more than one second after the last stored event", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:15.500Z")),
    "stored",
  );
});

test("uses millisecond precision for timestamp comparison", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100999Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  // Both source timestamps are interpreted at millisecond precision.
  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:13.100000Z")),
    "stored",
  );
});

test("long gaps store only the current event and create no synthetic points", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  await writer.process(makeMarketPrice("2026-08-18T19:30:12.100Z"));

  assert.deepEqual(
    repository.writes.map((point) => point.eventTimestamp),
    ["2026-08-18T19:30:12.100Z"],
  );
});

test("uses eventTimestamp rather than receivedTimestamp for the interval", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  const result = await writer.process(
    makeMarketPrice("2026-08-18T18:30:12.500Z", "2026-08-18T19:30:12.500Z"),
  );

  assert.equal(result, "skipped");
});

test("failed writes do not advance the stored timestamp", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  repository.failNextWrite = true;

  await assert.rejects(
    writer.process(makeMarketPrice("2026-08-18T18:30:13.100Z")),
    /write failed/,
  );

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:13.200Z")),
    "stored",
  );
});

test("initializes the stored timestamp from the latest repository item", async () => {
  const repository = new FakeRepository("2026-08-18T18:30:12.100Z");
  const writer = await PriceHistoryWriter.create({
    product: "BTC-USD",
    repository,
  });

  assert.equal(
    await writer.process(makeMarketPrice("2026-08-18T18:30:12.500Z")),
    "skipped",
  );
});
