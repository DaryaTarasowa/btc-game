import { describe, expect, it } from "vitest";
import { parsePriceResponse } from "./prices";

describe("parsePriceResponse", () => {
  it("parses valid price data without reordering the API response", () => {
    expect(
      parsePriceResponse({
        prices: [
          { price: "64473.12", eventTimestamp: "2026-08-19T01:00:00Z" },
          { price: "64472.46", eventTimestamp: "2026-08-19T00:59:20Z" },
        ],
      }),
    ).toEqual([
      { price: "64473.12", eventTimestamp: "2026-08-19T01:00:00Z" },
      { price: "64472.46", eventTimestamp: "2026-08-19T00:59:20Z" },
    ]);
  });

  it.each(["0", "-1", "not-a-price", "Infinity"])(
    "rejects invalid price %s",
    (price) => {
      expect(() =>
        parsePriceResponse({
          prices: [{ price, eventTimestamp: "2026-08-19T00:59:20Z" }],
        }),
      ).toThrow();
    },
  );

  it("rejects an invalid timestamp", () => {
    expect(() =>
      parsePriceResponse({
        prices: [{ price: "64472.46", eventTimestamp: "yesterday" }],
      }),
    ).toThrow();
  });

  it("rejects an invalid response shape", () => {
    expect(() =>
      parsePriceResponse({
        prices: [{ price: "64472.46", sourceTimestamp: "2026-08-19T00:59:20Z" }],
      }),
    ).toThrow();
  });
});
