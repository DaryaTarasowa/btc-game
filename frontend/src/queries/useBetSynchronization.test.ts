import { afterEach, expect, test, vi } from "vitest";
import type { ActiveBet, ResolvedBet } from "@/api/bets";
import { millisecondsUntilTarget, statusRefetchInterval, statusStaleTime } from "@/queries/useBetSynchronization";

const active = {
  status: "active",
  resolutionTargetTimestamp: "2026-08-20T12:01:00.000Z",
} as ActiveBet;

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

test("caps elapsed targets at zero and keeps resolved data indefinitely fresh", () => {
  expect(millisecondsUntilTarget(active, Date.parse("2026-08-20T12:02:00.000Z"))).toBe(0);
  expect(statusStaleTime({ status: "resolved" } as ResolvedBet)).toBe(Infinity);
  expect(statusStaleTime(undefined)).toBe(Infinity);
});
