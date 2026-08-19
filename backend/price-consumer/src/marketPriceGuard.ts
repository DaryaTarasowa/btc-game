import assert from "node:assert/strict";
import test from "node:test";

import { MarketPriceGuard } from "./marketPriceGuard.test.js";
import type { MarketPriceEventData } from "./types.js";

const makeMarketPrice = (
  eventTimestamp: string,
  price = "1",
): MarketPriceEventData => ({
  product: "BTC-USD",
  price,
  eventTimestamp,
  receivedTimestamp: "2099-01-01T00:00:00.000Z",
});

test("processes the first market price", () => {
  const guard = new MarketPriceGuard();

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "100")),
    false,
  );
});

test("skips market prices with equal or older event timestamps", () => {
  const guard = new MarketPriceGuard();

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "100")),
    false,
  );

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "101")),
    true,
  );

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.099Z", "102")),
    true,
  );
});

test("processes a newer event when the price changed", () => {
  const guard = new MarketPriceGuard();

  guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "100"));

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.101Z", "101")),
    false,
  );
});

test("skips a newer event when the price did not change", () => {
  const guard = new MarketPriceGuard();

  guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "100"));

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.101Z", "100")),
    true,
  );
});

test("unchanged prices still advance the latest event timestamp", () => {
  const guard = new MarketPriceGuard();

  guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.100Z", "100"));

  // Newer event, but unchanged price: skipped.
  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.200Z", "100")),
    true,
  );

  // Price changed, but this event is older than the .200 event above.
  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.150Z", "101")),
    true,
  );

  // Newer than everything seen so far and changed price: process.
  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.201Z", "101")),
    false,
  );
});

test("event ordering uses millisecond precision", () => {
  const guard = new MarketPriceGuard();

  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.101Z", "100")),
    false,
  );

  // Date.parse truncates sub-millisecond precision,
  // so this is considered the same event time.
  assert.equal(
    guard.shouldSkip(makeMarketPrice("2026-08-18T18:30:12.101001Z", "101")),
    true,
  );
});
