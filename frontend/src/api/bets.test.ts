import { afterEach, expect, test, vi } from "vitest";
import { betChartWindow, canReconstructBet, createBet, getBet, getCompletedBets, reconstructableBetHistory, type ResolvedBet } from "@/api/bets";

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
    betId: "bet-id",
    playerId: "550e8400-e29b-41d4-a716-446655440000",
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
    betId: "bet-id",
    playerId: "550e8400-e29b-41d4-a716-446655440000",
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

test("uses a backend bet-creation error when one is provided", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ message: "An active bet already exists." }),
  }));
  await expect(createBet({ direction: "down", point: { price: "100", eventTimestamp: "2026-08-20T12:00:00Z" } }))
    .rejects.toThrow("An active bet already exists.");
});

test("falls back to the HTTP status for a non-JSON bet-creation failure", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not JSON"); } }));
  await expect(createBet({ direction: "up", point: { price: "100", eventTimestamp: "2026-08-20T12:00:00Z" } }))
    .rejects.toThrow("Bet creation failed (500)");
});

test.each([403, 404])("treats status %s as an inaccessible bet", async (status) => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets/");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
  const { BetNotFoundError } = await import("@/api/bets");
  await expect(getBet("bet with spaces")).rejects.toBeInstanceOf(BetNotFoundError);
  expect(fetch).toHaveBeenCalledWith("https://example.test/bets/bet%20with%20spaces", expect.any(Object));
});

test("reports other status failures and rejects malformed successful data", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(getBet("bet-1")).rejects.toThrow("could not be loaded (503)");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "active" }) }));
  await expect(getBet("bet-1")).rejects.toThrow();
});

test("requires a configured betting endpoint", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "");
  await expect(getBet("bet-1")).rejects.toThrow("endpoint is not configured");
});

test("loads the authenticated user's completed bets", async () => {
  vi.stubEnv("VITE_CREATE_BET_URL", "https://example.test/bets/");
  const bet = {
    betId: "bet-id", playerId: "subject-1", direction: "up", status: "resolved",
    result: "won", startPrice: "100", endPrice: "101", startEventTimestamp: "2026-08-20T12:00:00Z",
    resolutionTargetTimestamp: "2026-08-20T12:01:00Z", endEventTimestamp: "2026-08-20T12:01:01Z",
    createdAt: "2026-08-20T12:00:01Z",
  };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bets: [bet] }) });
  vi.stubGlobal("fetch", fetchMock);
  await expect(getCompletedBets()).resolves.toEqual([bet]);
  expect(fetchMock).toHaveBeenCalledWith("https://example.test/bets", expect.objectContaining({ headers: { authorization: "Bearer test-id-token" } }));
});

test("reconstruction availability expires ten hours after the bet's source start", () => {
  const bet = { startEventTimestamp: "2026-08-20T02:00:00Z" } as ResolvedBet;
  expect(canReconstructBet(bet, Date.parse("2026-08-20T11:59:54.999Z"))).toBe(true);
  expect(canReconstructBet(bet, Date.parse("2026-08-20T11:59:55Z"))).toBe(false);
});

test("chart reconstruction includes five seconds around both bet endpoints", () => {
  const bet = {
    startEventTimestamp: "2026-08-20T12:00:00.123Z",
    endEventTimestamp: "2026-08-20T12:01:01.456Z",
  } as ResolvedBet;
  expect(betChartWindow(bet)).toEqual({
    start: "2026-08-20T11:59:55.123Z",
    end: "2026-08-20T12:01:06.456Z",
  });
});

test("history separates reconstructable bets from the older count", () => {
  const current = { betId: "current", startEventTimestamp: "2026-08-20T11:00:00Z" } as ResolvedBet;
  const old = { betId: "old", startEventTimestamp: "2026-08-20T01:00:00Z" } as ResolvedBet;
  expect(reconstructableBetHistory([current, old], Date.parse("2026-08-20T12:00:00Z"))).toEqual({
    bets: [current],
    olderCount: 1,
  });
});
