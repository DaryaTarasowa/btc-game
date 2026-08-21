import assert from "node:assert/strict";
import test from "node:test";

import { MarketPriceGuard } from "../marketPriceGuard.js";
import type { MarketPriceEventData } from "../types.js";

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
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.100Z", "100")),
    "accepted",
  );
});

test("identifies equal or older event timestamps", () => {
  const guard = new MarketPriceGuard();
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.100Z", "100")),
    "accepted",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.100Z", "101")),
    "non_increasing_event_timestamp",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.099Z", "102")),
    "non_increasing_event_timestamp",
  );
});

test("distinguishes a newer changed price from a newer unchanged price", () => {
  const guard = new MarketPriceGuard();
  guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.100Z", "100"));
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.101Z", "101")),
    "accepted",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.102Z", "101")),
    "unchanged_price",
  );
});

test("unchanged prices still advance the latest event timestamp", () => {
  const guard = new MarketPriceGuard();
  guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.100Z", "100"));
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.200Z", "100")),
    "unchanged_price",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.150Z", "101")),
    "non_increasing_event_timestamp",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.201Z", "101")),
    "accepted",
  );
});

test("event ordering preserves Coinbase fractional-second precision", () => {
  const guard = new MarketPriceGuard();
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.101Z", "100")),
    "accepted",
  );
  assert.equal(
    guard.evaluate(makeMarketPrice("2026-08-18T18:30:12.101001Z", "101")),
    "accepted",
  );
});
