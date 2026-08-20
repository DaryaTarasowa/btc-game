import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecentPrices, parsePriceResponse } from "@/api/prices";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("parsePriceResponse", () => {
  it("parses valid price data without reordering the API response", () => {
    expect(
      parsePriceResponse({
        prices: [
          { product: "BTC-USD", price: "64473.12", eventTimestamp: "2026-08-19T01:00:00Z" },
          { product: "BTC-USD", price: "64472.46", eventTimestamp: "2026-08-19T00:59:20Z" },
        ],
      }),
    ).toEqual([
      { product: "BTC-USD", price: "64473.12", eventTimestamp: "2026-08-19T01:00:00Z" },
      { product: "BTC-USD", price: "64472.46", eventTimestamp: "2026-08-19T00:59:20Z" },
    ]);
  });

  it.each(["0", "-1", "not-a-price", "Infinity"])(
    "rejects invalid price %s",
    (price) => {
      expect(() =>
        parsePriceResponse({
          prices: [{ product: "BTC-USD", price, eventTimestamp: "2026-08-19T00:59:20Z" }],
        }),
      ).toThrow();
    },
  );

  it("rejects an invalid timestamp", () => {
    expect(() =>
      parsePriceResponse({
        prices: [{ product: "BTC-USD", price: "64472.46", eventTimestamp: "yesterday" }],
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

describe("getRecentPrices", () => {
  it("loads and validates price history", async () => {
    vi.stubEnv("VITE_GET_PRICES_URL", "https://example.test/prices");
    const prices = [{ product: "BTC-USD", price: "100.25", eventTimestamp: "2026-08-20T12:00:00Z" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prices }) });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(getRecentPrices({ product: "BTC-USD", signal: controller.signal })).resolves.toEqual(prices);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/prices?product=BTC-USD", { signal: controller.signal });
  });

  it("requests an explicit historical bet window", async () => {
    vi.stubEnv("VITE_GET_PRICES_URL", "https://example.test/prices");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prices: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await getRecentPrices({ product: "BTC-USD", start: "2026-08-20T12:00:00Z", end: "2026-08-20T12:01:01Z" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.test/prices?product=BTC-USD&start=2026-08-20T12%3A00%3A00Z&end=2026-08-20T12%3A01%3A01Z");
  });

  it("reports configuration, HTTP, and malformed-response failures", async () => {
    vi.stubEnv("VITE_GET_PRICES_URL", "");
    await expect(getRecentPrices({ product: "BTC-USD" })).rejects.toThrow("endpoint is not configured");
    vi.stubEnv("VITE_GET_PRICES_URL", "https://example.test/prices");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(getRecentPrices({ product: "BTC-USD" })).rejects.toThrow("could not be loaded (502)");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prices: [{ price: "bad" }] }) }));
    await expect(getRecentPrices({ product: "BTC-USD" })).rejects.toThrow("malformed price history");
  });
});
