import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCoinbaseMessage as normalizeConfiguredCoinbaseMessage } from "../coinbaseMapper.js";

const RECEIVED_TIMESTAMP = "2026-08-18T18:30:12.140Z";
const EVENT_TIMESTAMP = "2026-08-18T18:30:12.123456Z";
const PRODUCTS = ["BTC-USD"];
const normalizeCoinbaseMessage = (value: unknown, receivedTimestamp: string) =>
  normalizeConfiguredCoinbaseMessage(value, receivedTimestamp, PRODUCTS);

test("normalizes a valid BTC-USD ticker", () => {
  const marketPrice = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "BTC-USD",
      price: "59432.10",
      time: EVENT_TIMESTAMP,
      sequence: 123456789,
      trade_id: 987654321,
    },
    RECEIVED_TIMESTAMP,
  );

  assert.deepEqual(marketPrice, {
    product: "BTC-USD",
    price: "59432.10",
    eventTimestamp: EVENT_TIMESTAMP,
    receivedTimestamp: RECEIVED_TIMESTAMP,
    sequence: 123456789,
    tradeId: 987654321,
  });
});

test("returns null for non-object messages", () => {
  assert.equal(normalizeCoinbaseMessage(null, RECEIVED_TIMESTAMP), null);
  assert.equal(normalizeCoinbaseMessage("ticker", RECEIVED_TIMESTAMP), null);
  assert.equal(normalizeCoinbaseMessage([], RECEIVED_TIMESTAMP), null);
});

test("returns null for non-ticker messages", () => {
  assert.equal(
    normalizeCoinbaseMessage({ type: "heartbeat" }, RECEIVED_TIMESTAMP),
    null,
  );

  assert.equal(
    normalizeCoinbaseMessage({ type: "subscriptions" }, RECEIVED_TIMESTAMP),
    null,
  );
});

test("returns null for non-BTC-USD ticker messages", () => {
  const marketPrice = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "ETH-USD",
      price: "4000.00",
      time: EVENT_TIMESTAMP,
    },
    RECEIVED_TIMESTAMP,
  );

  assert.equal(marketPrice, null);
});

test("returns null for an invalid price", () => {
  assert.equal(
    normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "BTC-USD",
        price: "not-a-price",
        time: EVENT_TIMESTAMP,
      },
      RECEIVED_TIMESTAMP,
    ),
    null,
  );

  assert.equal(
    normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "BTC-USD",
        price: "0",
        time: EVENT_TIMESTAMP,
      },
      RECEIVED_TIMESTAMP,
    ),
    null,
  );

  assert.equal(
    normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "BTC-USD",
        price: "-1",
        time: EVENT_TIMESTAMP,
      },
      RECEIVED_TIMESTAMP,
    ),
    null,
  );
});

test("accepts valid positive decimal prices", () => {
  for (const price of ["1", "0.01", "59432.10"]) {
    const marketPrice = normalizeCoinbaseMessage(
      {
        type: "ticker",
        product_id: "BTC-USD",
        price,
        time: EVENT_TIMESTAMP,
      },
      RECEIVED_TIMESTAMP,
    );

    assert.equal(marketPrice?.price, price);
  }
});

test("returns null for an invalid event timestamp", () => {
  const marketPrice = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "BTC-USD",
      price: "59432.10",
      time: "not-a-timestamp",
    },
    RECEIVED_TIMESTAMP,
  );

  assert.equal(marketPrice, null);
});

test("omits invalid optional sequence and trade id", () => {
  const marketPrice = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "BTC-USD",
      price: "59432.10",
      time: EVENT_TIMESTAMP,
      sequence: "wrong",
      trade_id: Number.MAX_SAFE_INTEGER + 1,
    },
    RECEIVED_TIMESTAMP,
  );

  assert.deepEqual(marketPrice, {
    product: "BTC-USD",
    price: "59432.10",
    eventTimestamp: EVENT_TIMESTAMP,
    receivedTimestamp: RECEIVED_TIMESTAMP,
  });
});

test("does not convert the price string", () => {
  const marketPrice = normalizeCoinbaseMessage(
    {
      type: "ticker",
      product_id: "BTC-USD",
      price: "59432.10",
      time: EVENT_TIMESTAMP,
    },
    RECEIVED_TIMESTAMP,
  );

  assert.equal(marketPrice?.price, "59432.10");
});
