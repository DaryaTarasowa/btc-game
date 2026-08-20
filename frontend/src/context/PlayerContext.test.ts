import { expect, test, vi } from "vitest";
import { removePlayerQueries } from "@/context/PlayerContext";

test("logout cleanup removes only the departing player's queries", () => {
  const removeQueries = vi.fn();
  removePlayerQueries({ removeQueries } as never, "player-1");

  expect(removeQueries).toHaveBeenNthCalledWith(1, { queryKey: ["player", "player-1"] });
  expect(removeQueries).toHaveBeenNthCalledWith(2, { queryKey: ["bets", "player-1"] });
});
