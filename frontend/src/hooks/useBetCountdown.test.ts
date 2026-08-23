// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBetCountdown } from "@/hooks/useBetCountdown";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("counts down against the target timestamp and stops at zero", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-21T12:00:00.000Z");

  const { result } = renderHook(() =>
    useBetCountdown("2026-08-21T12:00:01.000Z"),
  );
  expect(result.current).toBe(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_250);
  });
  expect(result.current).toBe(0);
});

test("cleans up its interval when the target is removed", () => {
  vi.useFakeTimers();
  const clearInterval = vi.spyOn(window, "clearInterval");
  const { rerender } = renderHook(({ target }) => useBetCountdown(target), {
    initialProps: { target: "2026-08-21T12:01:00.000Z" as string | undefined },
  });

  rerender({ target: undefined });
  expect(clearInterval).toHaveBeenCalledOnce();
});
