import assert from "node:assert/strict";
import test from "node:test";
import { createPriceWindow, toPriceResponse } from "./prices.mjs";

test("maps DynamoDB fields to the public model in chronological order", () => {
  assert.deepEqual(
    toPriceResponse([
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
          price: "64472.46",
          eventTimestamp: "2026-08-19T00:59:20.743229Z",
        },
        {
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
  assert.deepEqual(toPriceResponse([
    null,
    { price: 100, sourceTimestamp: "2026-08-19T01:00:00.000000Z" },
    { price: "100" },
    { price: "101", sourceTimestamp: "2026-08-19T01:00:01.000000Z" },
  ]), {
    prices: [{ price: "101", eventTimestamp: "2026-08-19T01:00:01.000000Z" }],
  });
});
