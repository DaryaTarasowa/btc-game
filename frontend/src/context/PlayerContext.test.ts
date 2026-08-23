import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";

import { removePlayerQueries } from "@/context/PlayerContext";
import { queryKeys } from "@/queryKeys";

test("removes all cached queries belonging to the departing player", () => {
  const queryClient = new QueryClient();

  queryClient.setQueryData(queryKeys.player("player-1"), {
    playerId: "player-1",
  });
  queryClient.setQueryData(queryKeys.betHistory("player-1"), ["history"]);
  queryClient.setQueryData(queryKeys.bet("player-1", "bet-1"), {
    betId: "bet-1",
  });

  queryClient.setQueryData(queryKeys.player("player-2"), {
    playerId: "player-2",
  });
  queryClient.setQueryData(queryKeys.bet("player-2", "bet-2"), {
    betId: "bet-2",
  });

  removePlayerQueries(queryClient, "player-1");

  expect(
    queryClient.getQueryData(queryKeys.player("player-1")),
  ).toBeUndefined();

  expect(
    queryClient.getQueryData(queryKeys.betHistory("player-1")),
  ).toBeUndefined();

  expect(
    queryClient.getQueryData(queryKeys.bet("player-1", "bet-1")),
  ).toBeUndefined();

  // Another player's cache must stay untouched.
  expect(queryClient.getQueryData(queryKeys.player("player-2"))).toBeDefined();

  expect(
    queryClient.getQueryData(queryKeys.bet("player-2", "bet-2")),
  ).toBeDefined();
});
