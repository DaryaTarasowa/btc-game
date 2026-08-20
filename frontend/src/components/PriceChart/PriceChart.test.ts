import { expect, test } from "vitest";
import { chartHeadlinePrice, resolutionPriceLineOptions, toChartData } from "@/components/PriceChart/PriceChart";
import type { ResolvedBet } from "@/api/bets";

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

test("static history headlines the authoritative resolution price, not a later chart point", () => {
  const prices = [{ price: "71729.76", eventTimestamp: "2026-08-20T12:01:05Z" }];
  const bet = { status: "resolved", endPrice: "71724.9" } as ResolvedBet;
  expect(chartHeadlinePrice(prices, bet, true)).toBe("71724.9");
  expect(chartHeadlinePrice(prices, bet, false)).toBe("71729.76");
});

test.each([
  ["won", "#35d59a"],
  ["lost", "#ff6877"],
] as const)("static %s bets draw the horizontal line at the resolution price", (result, color) => {
  const bet = { status: "resolved", result, endPrice: "71724.9" } as ResolvedBet;
  expect(resolutionPriceLineOptions(bet, true)).toMatchObject({
    price: 71724.9,
    color,
    axisLabelVisible: true,
    title: "Resolved",
  });
  expect(resolutionPriceLineOptions(bet, false)).toBeNull();
});
