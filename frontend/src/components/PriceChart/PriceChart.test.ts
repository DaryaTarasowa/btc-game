import { expect, test } from "vitest";
import { activeBetChartRange, betGraphColor, betGuideColors, chartHeadlinePrice, referencePriceLineOptions, staticGraphFillColors, toChartData } from "@/components/PriceChart/PriceChart";
import type { ActiveBet, ResolvedBet } from "@/api/bets";

test("sorts chart data and keeps the latest point within each whole second", () => {
  expect(toChartData([
    { product: "BTC-USD", price: "102", eventTimestamp: "2026-08-20T12:00:02.100Z" },
    { product: "BTC-USD", price: "100", eventTimestamp: "2026-08-20T12:00:01.100Z" },
    { product: "BTC-USD", price: "101", eventTimestamp: "2026-08-20T12:00:01.900Z" },
  ])).toEqual([
    { time: Date.parse("2026-08-20T12:00:01Z") / 1_000, value: 101, eventTimestamp: "2026-08-20T12:00:01.900Z" },
    { time: Date.parse("2026-08-20T12:00:02Z") / 1_000, value: 102, eventTimestamp: "2026-08-20T12:00:02.100Z" },
  ]);
});

test("does not mutate the history returned by the API", () => {
  const prices = [
    { product: "BTC-USD", price: "2", eventTimestamp: "2026-08-20T12:00:02Z" },
    { product: "BTC-USD", price: "1", eventTimestamp: "2026-08-20T12:00:01Z" },
  ];
  toChartData(prices);
  expect(prices[0]?.price).toBe("2");
});

test("static chart keeps an authoritative resolution event over a later sample in the same second", () => {
  const resolutionTimestamp = "2026-08-20T12:01:00.100Z";
  expect(toChartData([
    { product: "BTC-USD", price: "101", eventTimestamp: resolutionTimestamp },
    { product: "BTC-USD", price: "99", eventTimestamp: "2026-08-20T12:01:00.900Z" },
  ], [resolutionTimestamp])).toEqual([
    {
      time: Date.parse("2026-08-20T12:01:00Z") / 1_000,
      value: 101,
      eventTimestamp: resolutionTimestamp,
    },
  ]);
});

test("static history headlines the authoritative resolution price, not a later chart point", () => {
  const prices = [{ product: "BTC-USD", price: "71729.76", eventTimestamp: "2026-08-20T12:01:05Z" }];
  const bet = { status: "resolved", endPrice: "71724.9" } as ResolvedBet;
  expect(chartHeadlinePrice(prices, bet, true)).toBe("71724.9");
  expect(chartHeadlinePrice(prices, bet, false)).toBe("71729.76");
});

test.each([
  ["won", "#35d59a"],
  ["lost", "#ff6877"],
] as const)("static %s bets draw both horizontal references in the result color", (result, color) => {
  const bet = { status: "resolved", result, startPrice: "71720.1", endPrice: "71724.9" } as ResolvedBet;
  expect(referencePriceLineOptions(bet, true)).toEqual([
    expect.objectContaining({ price: 71720.1, color, axisLabelVisible: true, title: "Placed" }),
    expect.objectContaining({ price: 71724.9, color, axisLabelVisible: true, title: "Resolved" }),
  ]);
  expect(referencePriceLineOptions(bet, false)).toEqual([]);
});

test("lost static annotations are red while an UP graph remains green", () => {
  const bet = { direction: "up", status: "resolved", result: "lost" } as ResolvedBet;
  expect(betGraphColor(bet)).toBe("#35d59a");
  expect(betGuideColors({ direction: "up", status: "resolved", result: "lost" } as ResolvedBet)).toEqual({
    creation: "#ff6877",
    resolution: "#ff6877",
  });
  expect(staticGraphFillColors(bet).top).toContain("53, 213, 154");
});

test("won static annotations are green while a DOWN graph remains red", () => {
  const bet = { direction: "down", status: "resolved", result: "won" } as ResolvedBet;
  expect(betGraphColor(bet)).toBe("#ff6877");
  expect(betGuideColors(bet)).toEqual({ creation: "#35d59a", resolution: "#35d59a" });
  expect(staticGraphFillColors(bet).top).toContain("255, 104, 119");
});

test("active bet chart spans from five seconds before placement through its resolution target", () => {
  const bet = {
    status: "active",
    direction: "up",
    startPrice: "100",
    startEventTimestamp: "2026-08-20T12:00:00.500Z",
    resolutionTargetTimestamp: "2026-08-20T12:01:00.500Z",
  } as ActiveBet;

  expect(activeBetChartRange(bet)).toEqual({
    from: Date.parse("2026-08-20T11:59:55Z") / 1_000,
    to: Date.parse("2026-08-20T12:01:00Z") / 1_000,
  });
  expect(referencePriceLineOptions(bet, false)).toEqual([
    expect.objectContaining({ price: 100, color: "#35d59a", title: "Placed" }),
  ]);
});
