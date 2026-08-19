import { afterEach, expect, test, vi } from "vitest";
import type { ActiveBet } from "../api/bets";
import { readStoredActiveBet, storeActiveBet } from "./useStoredActiveBet";

const bet: ActiveBet = {
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

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

test("stores and restores the denormalized active bet per player", () => {
  vi.stubGlobal("localStorage", fakeStorage());
  storeActiveBet(bet);
  expect(readStoredActiveBet(bet.playerId)).toEqual(bet);
  expect(readStoredActiveBet("e7f98e76-d392-41f7-981f-f2566746c13d")).toBeNull();
});

test("discards malformed cached data", () => {
  const storage = fakeStorage();
  vi.stubGlobal("localStorage", storage);
  storage.setItem(`btc-game.activeBet.v1.${bet.playerId}`, "not-json");
  expect(readStoredActiveBet(bet.playerId)).toBeNull();
});
