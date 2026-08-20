import assert from "node:assert/strict";
import test from "node:test";
import { createPriceWindow, requestedPriceWindow, toPriceResponse } from "./prices.mjs";

test("maps DynamoDB fields to the public model in chronological order", () => {
  assert.deepEqual(
    toPriceResponse("BTC-USD", [
      {
        product: "BTC-USD",
        price: "64473.12",
        sourceTimestamp: "2026-08-19T00:59:21.000000Z",
        expiresAt: 123,
      },
      {
        product: "BTC-USD",
        price: "64472.46",
        sourceTimestamp: "2026-08-19T00:59:20.743229Z",
        expiresAt: 123,
      },
    ]),
    {
      prices: [
        {
          product: "BTC-USD",
          price: "64472.46",
          eventTimestamp: "2026-08-19T00:59:20.743229Z",
        },
        {
          product: "BTC-USD",
          price: "64473.12",
          eventTimestamp: "2026-08-19T00:59:21.000000Z",
        },
      ],
    },
  );
});

test("creates an explicit three-minute query window", () => {
  assert.deepEqual(createPriceWindow(new Date("2026-08-19T01:00:00.000Z")), {
    start: "2026-08-19T00:57:00.000000Z",
    end: "2026-08-19T01:00:00.000000Z",
  });
});

test("drops malformed stored records without coercing them", () => {
  assert.deepEqual(toPriceResponse("BTC-USD", [
    null,
    { price: 100, sourceTimestamp: "2026-08-19T01:00:00.000000Z" },
    { price: "100" },
    { price: "101", sourceTimestamp: "2026-08-19T01:00:01.000000Z" },
  ]), {
    prices: [{ product: "BTC-USD", price: "101", eventTimestamp: "2026-08-19T01:00:01.000000Z" }],
  });
});

test("uses a requested historical window with normalized DynamoDB timestamps", () => {
  assert.deepEqual(requestedPriceWindow({
    start: "2026-08-19T00:00:00Z",
    end: "2026-08-19T00:01:01.123456Z",
  }), {
    start: "2026-08-19T00:00:00.000000Z",
    end: "2026-08-19T00:01:01.123456Z",
  });
});

test("rejects partial, reversed, invalid, and over-ten-hour windows", () => {
  assert.equal(requestedPriceWindow({ start: "2026-08-19T00:00:00Z" }), null);
  assert.equal(requestedPriceWindow({ start: "later", end: "never" }), null);
  assert.equal(requestedPriceWindow({ start: "2026-08-19T01:00:00Z", end: "2026-08-19T00:00:00Z" }), null);
  assert.equal(requestedPriceWindow({ start: "2026-08-19T00:00:00Z", end: "2026-08-19T10:00:00.001Z" }), null);
  assert.equal(requestedPriceWindow({ start: "2026-08-19T00:00:00+01:00", end: "2026-08-19T01:00:00+01:00" }), null);
});
