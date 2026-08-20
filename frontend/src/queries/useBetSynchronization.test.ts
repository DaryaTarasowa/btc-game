import { afterEach, expect, test, vi } from "vitest";
import type { ActiveBet, ResolvedBet } from "../api/bets";
import { clearBetPointer, millisecondsUntilTarget, readBetPointer, statusRefetchInterval, statusStaleTime, storeBetPointer } from "./useBetSynchronization";

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
