import { afterEach, expect, test, vi } from "vitest";
import { createBet, getBet } from "./bets";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "test-id-token" } } }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("loads authoritative resolved status using only the bet ID", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets");
  const resolved = {
    id: "bet-id",
    playerId: "550e8400-e29b-41d4-a716-446655440000",
    recordKey: "BET#2026-08-20T12:34:56.123456Z#bet-id",
    direction: "up",
    status: "resolved",
    result: "won",
    startPrice: "100",
    startEventTimestamp: "2026-08-20T12:34:56.123456Z",
    resolutionTargetTimestamp: "2026-08-20T12:35:56.123456Z",
    endPrice: "101",
    endEventTimestamp: "2026-08-20T12:35:57.000000Z",
    createdAt: "2026-08-20T12:35:00.000Z",
  };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => resolved });
  vi.stubGlobal("fetch", fetchMock);
  await expect(getBet("bet-id")).resolves.toEqual(resolved);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.test/bets/bet-id");
});

test("sends the exact visible price and event timestamp", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets");
  const response = {
    id: "bet-id",
    playerId: "550e8400-e29b-41d4-a716-446655440000",
    recordKey: "ACTIVE",
    direction: "up",
    status: "active",
    startPrice: "113245.37",
    startEventTimestamp: "2026-08-20T12:34:56.123456Z",
    resolutionTargetTimestamp: "2026-08-20T12:35:56.123456Z",
    createdAt: "2026-08-20T12:35:00.000Z",
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });
  vi.stubGlobal("fetch", fetchMock);

  await createBet({
    direction: "up",
    point: {
      price: response.startPrice,
      eventTimestamp: response.startEventTimestamp,
    },
  });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      method: "POST",
      headers: {
        authorization: "Bearer test-id-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        direction: "up",
        startPrice: response.startPrice,
        startEventTimestamp: response.startEventTimestamp,
      }),
    }),
  );
});
