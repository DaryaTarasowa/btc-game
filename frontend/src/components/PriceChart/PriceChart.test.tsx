// @vitest-environment jsdom

import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PriceChart } from "@/components/PriceChart/PriceChart";
import { toChartData } from "./priceChartUtils";

afterEach(cleanup);

test("renders default loading, error, and empty states", () => {
  const view = render(<PriceChart isPending />);

  expect(screen.getByRole("status").textContent).toContain(
    "Loading market prices…",
  );

  view.rerender(<PriceChart error={new Error("Price service failed.")} />);

  expect(screen.getByRole("alert").textContent).toContain(
    "Price service failed.",
  );

  view.rerender(<PriceChart />);

  expect(screen.getByRole("status").textContent).toContain(
    "No market prices are available.",
  );
});

test("allows chart-state messages and sizing to be customized", () => {
  render(
    <PriceChart
      isPending
      stateClassName="min-h-55"
      messages={{
        loading: "Reconstructing stored market window…",
      }}
    />,
  );

  const state = screen.getByRole("status");

  expect(state.textContent).toContain("Reconstructing stored market window…");
  expect(state.className.split(" ")).toContain("min-h-55");
});

test("sorts chart data and keeps the latest point within each whole second", () => {
  expect(
    toChartData([
      {
        product: "BTC-USD",
        price: "102",
        eventTimestamp: "2026-08-20T12:00:02.100Z",
      },
      {
        product: "BTC-USD",
        price: "100",
        eventTimestamp: "2026-08-20T12:00:01.100Z",
      },
      {
        product: "BTC-USD",
        price: "101",
        eventTimestamp: "2026-08-20T12:00:01.900Z",
      },
    ]),
  ).toEqual([
    {
      time: Date.parse("2026-08-20T12:00:01Z") / 1_000,
      value: 101,
      eventTimestamp: "2026-08-20T12:00:01.900Z",
    },
    {
      time: Date.parse("2026-08-20T12:00:02Z") / 1_000,
      value: 102,
      eventTimestamp: "2026-08-20T12:00:02.100Z",
    },
  ]);
});

test("does not mutate the history returned by the API", () => {
  const prices = [
    {
      product: "BTC-USD",
      price: "2",
      eventTimestamp: "2026-08-20T12:00:02Z",
    },
    {
      product: "BTC-USD",
      price: "1",
      eventTimestamp: "2026-08-20T12:00:01Z",
    },
  ];

  toChartData(prices);

  expect(prices[0]?.price).toBe("2");
});

test("priority timestamp wins over another sample in the same second", () => {
  const priorityTimestamp = "2026-08-20T12:01:00.100Z";

  expect(
    toChartData(
      [
        {
          product: "BTC-USD",
          price: "101",
          eventTimestamp: priorityTimestamp,
        },
        {
          product: "BTC-USD",
          price: "99",
          eventTimestamp: "2026-08-20T12:01:00.900Z",
        },
      ],
      [priorityTimestamp],
    ),
  ).toEqual([
    {
      time: Date.parse("2026-08-20T12:01:00Z") / 1_000,
      value: 101,
      eventTimestamp: priorityTimestamp,
    },
  ]);
});
