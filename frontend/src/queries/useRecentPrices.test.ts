import { expect, test } from "vitest";
import { appendRecentPrice } from "@/queries/useRecentPrices";

test("appends live prices and retains exactly the latest three wall-clock minutes", () => {
  const now = Date.parse("2026-08-20T12:03:00Z");
  const boundary = { product: "BTC-USD", price: "100", eventTimestamp: "2026-08-20T12:00:00Z" };
  const expired = { product: "BTC-USD", price: "99", eventTimestamp: "2026-08-20T11:59:59.999Z" };
  const incoming = { product: "BTC-USD", price: "101", eventTimestamp: "2026-08-20T12:03:00Z" };
  expect(appendRecentPrice([expired, boundary], incoming, now)).toEqual([boundary, incoming]);
});

test("returns a new collection without changing cached history", () => {
  const current = [{ product: "BTC-USD", price: "100", eventTimestamp: "2026-08-20T12:02:00Z" }];
  const result = appendRecentPrice(current, { product: "BTC-USD", price: "101", eventTimestamp: "2026-08-20T12:03:00Z" }, Date.parse("2026-08-20T12:03:00Z"));
  expect(result).not.toBe(current);
  expect(current).toHaveLength(1);
});
