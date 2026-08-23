// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vitest";
import { createElement, type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  BetNotFoundError,
  getBet,
  type ActiveBet,
  type ResolvedBet,
} from "@/api/bets";
import { BetStatus } from "@/domain/bets";
import {
  millisecondsUntilTarget,
  useBetSynchronization,
} from "@/hooks/useBetSynchronization";
import { queryKeys } from "@/queryKeys";

vi.mock("@/api/bets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/bets")>();

  return {
    ...actual,
    getBet: vi.fn(),
  };
});

const mockedGetBet = vi.mocked(getBet);

const active = {
  betId: "bet-1",
  status: BetStatus.Active,
  resolutionTargetTimestamp: "2026-08-20T12:01:00.000Z",
} as ActiveBet;

const resolved = {
  betId: "bet-1",
  status: BetStatus.Resolved,
} as ResolvedBet;

function setup(
  playerId: string | null = "player-1",
  persistedActiveBetId?: string,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const hook = renderHook(
    ({ playerId, persistedActiveBetId }) =>
      useBetSynchronization(playerId, persistedActiveBetId),
    {
      wrapper,
      initialProps: {
        playerId,
        persistedActiveBetId,
      },
    },
  );

  return { ...hook, queryClient };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

test("newly created active bets wait until their target without polling", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValue(active);

  const { result } = setup();

  act(() => {
    result.current.trackCreatedBet(active);
  });

  expect(millisecondsUntilTarget(active)).toBe(60_000);
  expect(result.current.activeBet).toEqual(active);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(59_999);
  });

  expect(mockedGetBet).not.toHaveBeenCalled();
});

test("reaching the target triggers the first backend status check", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValue(active);

  const { result } = setup();

  act(() => {
    result.current.trackCreatedBet(active);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(59_999);
  });

  expect(mockedGetBet).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });

  expect(mockedGetBet).toHaveBeenCalledOnce();
});

test("active bets poll every second after checking begins", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValue(active);

  const { result } = setup();

  act(() => {
    result.current.trackCreatedBet(active);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });

  expect(mockedGetBet).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });

  expect(mockedGetBet).toHaveBeenCalledTimes(2);
});

test("polling stops as soon as backend status is resolved", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValueOnce(resolved);

  const { result } = setup();

  act(() => {
    result.current.trackCreatedBet(active);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  expect(result.current.resolvedBet).toEqual(resolved);
  expect(mockedGetBet).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000);
  });

  expect(mockedGetBet).toHaveBeenCalledTimes(1);
});

test("resolution refreshes player data after bet resolution", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValue(resolved);

  const { result, queryClient } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  act(() => {
    result.current.trackCreatedBet(active);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["player", "player-1"],
  });
});

test("persisted bet IDs start in recovery mode", () => {
  mockedGetBet.mockImplementation(() => new Promise(() => {}));

  const { result } = setup("player-1", "bet-1");

  expect(result.current.isRecovering).toBe(true);
});

test("persisted recovery performs a fresh status request and accepts resolved backend state", async () => {
  mockedGetBet.mockResolvedValue(resolved);

  const { result } = setup("player-1", "bet-1");

  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalled();
    expect(result.current.resolvedBet).toEqual(resolved);
  });

  expect(result.current.activeBet).toBeNull();
});

test("stale cached active data is refreshed during persisted recovery", async () => {
  mockedGetBet.mockResolvedValue(resolved);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  queryClient.setQueryData(queryKeys.bet("player-1", "bet-1"), active);

  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const { result } = renderHook(
    () => useBetSynchronization("player-1", "bet-1"),
    { wrapper },
  );

  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalled();
    expect(result.current.resolvedBet).toEqual(resolved);
  });
});

test("recovered active bets wait in the future and poll immediately when overdue", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-08-20T12:00:00.000Z");

  mockedGetBet.mockResolvedValue(active);

  setup("player-1", "bet-1");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  const initialCalls = mockedGetBet.mock.calls.length;

  await act(async () => {
    await vi.advanceTimersByTimeAsync(59_000);
  });

  expect(mockedGetBet).toHaveBeenCalledTimes(initialCalls);

  vi.setSystemTime("2026-08-20T12:02:00.000Z");

  mockedGetBet.mockClear();
  setup("player-1", "bet-1");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  expect(mockedGetBet).toHaveBeenCalled();
});

test("logout and user changes cannot expose the previous player's bet", async () => {
  mockedGetBet.mockResolvedValue(active);

  const { result, rerender } = setup("player-1", "bet-1");

  await waitFor(() => {
    expect(result.current.activeBet).toEqual(active);
  });

  rerender({
    playerId: null,
    persistedActiveBetId: undefined,
  });

  await waitFor(() => {
    expect(result.current.activeBet).toBeNull();
    expect(result.current.resolvedBet).toBeNull();
  });
});

test("temporary fetch failure does not clear the tracked bet", async () => {
  mockedGetBet.mockRejectedValueOnce(new Error("Network error"));
  const { result } = setup("player-1", "bet-1");
  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalled();
  });
  // A transient error must not make us forget which bet we are recovering.
  expect(result.current.resolvedBet).toBeNull();
  expect(result.current.isRecovering).toBe(true);
});

test("bet synchronization resumes after a temporary recovery failure", async () => {
  mockedGetBet
    .mockRejectedValueOnce(new Error("Network error"))
    .mockResolvedValueOnce(resolved);
  const { result, queryClient } = setup("player-1", "bet-1");
  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalledTimes(1);
  });

  // Simulate connectivity returning by asking React Query to retry/refetch.
  await act(async () => {
    await queryClient.refetchQueries({
      queryKey: queryKeys.bet("player-1", "bet-1"),
    });
  });
  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalledTimes(2);
    expect(result.current.resolvedBet).toEqual(resolved);
  });
  expect(result.current.activeBet).toBeNull();
  expect(result.current.isRecovering).toBe(false);
});

test("a missing backend bet clears tracking", async () => {
  mockedGetBet.mockRejectedValue(new BetNotFoundError());

  const { result } = setup("player-1", "bet-1");

  await waitFor(() => {
    expect(mockedGetBet).toHaveBeenCalled();
    expect(result.current.isRecovering).toBe(false);
  });

  expect(result.current.isRecovering).toBe(false);
  expect(result.current.activeBet).toBeNull();
});
