// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";

import type { MarketPrice } from "@/api/prices";
import { appendRecentPrice, useLivePrices } from "@/hooks/useLivePrices";
import { MarketContext } from "@/context/MarketContext";
import { subscribeToLivePrices } from "@/api/livePrices";

vi.mock("@/api/livePrices", () => ({
  subscribeToLivePrices: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function price(eventTimestamp: string, value: string): MarketPrice {
  return {
    product: "BTC-USD",
    price: value,
    eventTimestamp,
  };
}

function LivePricesTestComponent() {
  useLivePrices();
  return null;
}

function renderLivePrices() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MarketContext.Provider
        value={{
          product: "BTC-USD",
          products: ["BTC-USD"],
          setProduct: vi.fn(),
        }}
      >
        <LivePricesTestComponent />
      </MarketContext.Provider>
    </QueryClientProvider>,
  );
}

test("retains exactly the latest three wall-clock minutes", () => {
  const now = Date.parse("2026-08-20T12:03:00Z");

  const expired = price("2026-08-20T11:59:59.999Z", "99");
  const boundary = price("2026-08-20T12:00:00Z", "100");
  const incoming = price("2026-08-20T12:03:00Z", "101");

  expect(appendRecentPrice([expired, boundary], incoming, now)).toEqual([
    boundary,
    incoming,
  ]);
});

test("keeps prices ordered by source event timestamp", () => {
  const now = Date.parse("2026-08-20T12:03:00Z");

  const first = price("2026-08-20T12:02:57Z", "100");
  const latest = price("2026-08-20T12:02:59Z", "102");
  const delayed = price("2026-08-20T12:02:58Z", "101");

  expect(appendRecentPrice([first, latest], delayed, now)).toEqual([
    first,
    delayed,
    latest,
  ]);
});

test("does not keep duplicate event timestamps", () => {
  const now = Date.parse("2026-08-20T12:03:00Z");

  const existing = price("2026-08-20T12:02:59Z", "100");
  const duplicate = price("2026-08-20T12:02:59Z", "100");

  const result = appendRecentPrice([existing], duplicate, now);

  expect(result).toHaveLength(1);
  expect(result[0].eventTimestamp).toBe("2026-08-20T12:02:59Z");
});

test("returns a new collection without changing cached history", () => {
  const current = [price("2026-08-20T12:02:00Z", "100")];

  const result = appendRecentPrice(
    current,
    price("2026-08-20T12:03:00Z", "101"),
    Date.parse("2026-08-20T12:03:00Z"),
  );

  expect(result).not.toBe(current);
  expect(current).toEqual([price("2026-08-20T12:02:00Z", "100")]);
});

test("unsubscribes if the subscription finishes after unmount", async () => {
  let resolveSubscription: ((cleanup: () => void) => void) | undefined;

  const unsubscribe = vi.fn();

  vi.mocked(subscribeToLivePrices).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSubscription = resolve;
      }),
  );

  const view = renderLivePrices();

  expect(subscribeToLivePrices).toHaveBeenCalledOnce();

  view.unmount();

  expect(unsubscribe).not.toHaveBeenCalled();

  await act(async () => {
    resolveSubscription?.(unsubscribe);
    await Promise.resolve();
  });

  expect(unsubscribe).toHaveBeenCalledOnce();
});
