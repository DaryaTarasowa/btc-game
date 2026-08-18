import assert from "node:assert/strict";
import test from "node:test";

import { LatestPriceSampler, normalizeCoinbaseMessage } from "./normalize.js";
import type { NormalizedPriceUpdate } from "./types.js";

test("normalizes a valid BTC-USD ticker without converting its price", () => {
  const update = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "BTC-USD",
      price: "59432.10",
      time: "2026-08-18T18:30:12.123456Z",
      sequence: 123456789,
      trade_id: 987654321,
    },
    "2026-08-18T18:30:12.140Z",
  );

  assert.deepEqual(update, {
    type: "price_update",
    source: "coinbase",
    product: "BTC-USD",
    price: "59432.10",
    sourceTimestamp: "2026-08-18T18:30:12.123456Z",
    receivedTimestamp: "2026-08-18T18:30:12.140Z",
    sequence: 123456789,
    tradeId: 987654321,
  });
});

test("rejects malformed, unexpected, and non-BTC ticker messages", () => {
  const receivedTimestamp = "2026-08-18T18:30:12.140Z";

  assert.equal(normalizeCoinbaseMessage(null, receivedTimestamp), null);
  assert.equal(normalizeCoinbaseMessage({ type: "heartbeat" }, receivedTimestamp), null);
  assert.equal(
    normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "ETH-USD",
        price: "4000.00",
        time: "2026-08-18T18:30:12.123456Z",
      },
      receivedTimestamp,
    ),
    null,
  );
  assert.equal(
    normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "BTC-USD",
        price: "not-a-price",
        time: "not-a-time",
      },
      receivedTimestamp,
    ),
    null,
  );
});

test("samples the latest update and allows only price changes", () => {
  const sampler = new LatestPriceSampler();
  const update: NormalizedPriceUpdate = {
    type: "price_update",
    source: "coinbase",
    product: "BTC-USD",
    price: "59432.10",
    sourceTimestamp: "2026-08-18T18:30:12.123456Z",
    receivedTimestamp: "2026-08-18T18:30:12.140Z",
  };

  sampler.add(update);
  sampler.add({ ...update, price: "59432.11" });
  assert.equal(sampler.takeChanged()?.price, "59432.11");
  assert.equal(sampler.takeChanged(), null);

  sampler.add({
    ...update,
    price: "59432.11",
    sourceTimestamp: "2026-08-18T18:30:13.123456Z",
  });
  assert.equal(sampler.takeChanged(), null);

  sampler.add({ ...update, price: "59432.12" });
  assert.equal(sampler.takeChanged()?.price, "59432.12");
});
