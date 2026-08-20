import { expect, test } from "vitest";
import { toChartData } from "./PriceChart";

test("sorts chart data and keeps the latest point within each whole second", () => {
  expect(toChartData([
    { price: "102", eventTimestamp: "2026-08-20T12:00:02.100Z" },
    { price: "100", eventTimestamp: "2026-08-20T12:00:01.100Z" },
    { price: "101", eventTimestamp: "2026-08-20T12:00:01.900Z" },
  ])).toEqual([
    { time: Date.parse("2026-08-20T12:00:01Z") / 1_000, value: 101, eventTimestamp: "2026-08-20T12:00:01.900Z" },
    { time: Date.parse("2026-08-20T12:00:02Z") / 1_000, value: 102, eventTimestamp: "2026-08-20T12:00:02.100Z" },
  ]);
});

test("does not mutate the history returned by the API", () => {
  const prices = [
    { price: "2", eventTimestamp: "2026-08-20T12:00:02Z" },
    { price: "1", eventTimestamp: "2026-08-20T12:00:01Z" },
  ];
  toChartData(prices);
  expect(prices[0]?.price).toBe("2");
});
