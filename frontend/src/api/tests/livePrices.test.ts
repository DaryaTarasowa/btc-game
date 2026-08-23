import { afterEach, expect, test, vi } from "vitest";

const connect = vi.fn();

vi.mock("@aws-amplify/api", () => ({
  events: { connect },
}));

afterEach(() => {
  connect.mockReset();
  vi.unstubAllEnvs();
});

test("forwards live events and closes every subscription resource", async () => {
  vi.stubEnv("VITE_APPSYNC_EVENTS_CHANNEL_PREFIX", "/prices");

  const unsubscribe = vi.fn();
  const close = vi.fn().mockResolvedValue(undefined);

  let observer: { next: (value: { event: unknown }) => void } | undefined;

  connect.mockResolvedValue({
    subscribe: vi.fn((value) => {
      observer = value;
      return { unsubscribe };
    }),
    close,
  });

  const { subscribeToLivePrices } = await import("@/api/livePrices");

  const onPrice = vi.fn();
  const cleanup = await subscribeToLivePrices("BTC-USD", onPrice);

  const price = {
    product: "BTC-USD",
    price: "100",
    eventTimestamp: "2026-08-20T12:00:00Z",
  };

  observer?.next({ event: price });

  expect(connect).toHaveBeenCalledWith("/prices/BTC-USD");
  expect(onPrice).toHaveBeenCalledWith(price);

  cleanup();

  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});

test("ignores invalid live price events", async () => {
  vi.stubEnv("VITE_APPSYNC_EVENTS_CHANNEL_PREFIX", "/prices");

  let observer: { next: (value: { event: unknown }) => void } | undefined;

  connect.mockResolvedValue({
    subscribe: vi.fn((value) => {
      observer = value;
      return { unsubscribe: vi.fn() };
    }),
    close: vi.fn().mockResolvedValue(undefined),
  });

  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const { subscribeToLivePrices } = await import("@/api/livePrices");

  const onPrice = vi.fn();

  await subscribeToLivePrices("BTC-USD", onPrice);

  observer?.next({
    event: {
      product: "BTC-USD",
      price: "-10",
      eventTimestamp: "not-a-date",
    },
  });

  expect(onPrice).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledOnce();

  consoleError.mockRestore();
});
