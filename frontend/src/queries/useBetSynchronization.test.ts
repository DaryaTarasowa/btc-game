import { afterEach, expect, test, vi } from "vitest";
import type { ActiveBet, ResolvedBet } from "@/api/bets";
import { clearBetPointer, millisecondsUntilTarget, readBetPointer, statusRefetchInterval, statusStaleTime, storeBetPointer } from "@/queries/useBetSynchronization";

const active = {
  status: "active",
  resolutionTargetTimestamp: "2026-08-20T12:01:00.000Z",
} as ActiveBet;

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("waits until the resolution target and does not poll before it", () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");
  expect(millisecondsUntilTarget(active, Date.parse("2026-08-20T12:00:00.000Z"))).toBe(60_000);
  expect(statusStaleTime(active)).toBe(60_000);
  expect(statusRefetchInterval(active, false)).toBe(false);
});

test("polls active status every second only after the target", () => {
  expect(millisecondsUntilTarget(active, Date.parse(active.resolutionTargetTimestamp))).toBe(0);
  expect(statusRefetchInterval(active, true)).toBe(1_000);
});

test("resolved status stops polling", () => {
  expect(statusRefetchInterval({ status: "resolved" } as ResolvedBet, true)).toBe(false);
});

test("localStorage contains only the bet ID pointer and is cleared on resolution", () => {
  vi.stubGlobal("localStorage", storage());
  storeBetPointer("player-1", "bet-1");
  expect(readBetPointer("player-1")).toBe("bet-1");
  clearBetPointer("player-1");
  expect(readBetPointer("player-1")).toBeNull();
});

test("rejects malformed stored pointers and removes the legacy full-bet cache", () => {
  const values = new Map([
    ["btc-game.activeBetId.v1.player-1", "../another-player"],
    ["btc-game.activeBet.v1.player-1", JSON.stringify({ id: "legacy" })],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  expect(readBetPointer("player-1")).toBeNull();
  expect(values.has("btc-game.activeBet.v1.player-1")).toBe(false);
  expect(readBetPointer(null)).toBeNull();
});

test("caps elapsed targets at zero and keeps resolved data indefinitely fresh", () => {
  expect(millisecondsUntilTarget(active, Date.parse("2026-08-20T12:02:00.000Z"))).toBe(0);
  expect(statusStaleTime({ status: "resolved" } as ResolvedBet)).toBe(Infinity);
  expect(statusStaleTime(undefined)).toBe(Infinity);
});
