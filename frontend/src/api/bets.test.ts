import { afterEach, expect, test, vi } from "vitest";
import { createBet } from "./bets";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "test-id-token" } } }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
