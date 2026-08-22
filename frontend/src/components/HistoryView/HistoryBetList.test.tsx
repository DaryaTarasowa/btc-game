// @vitest-environment jsdom

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ResolvedBet } from "@/api/bets";
import { HistoryBetList } from "@/components/HistoryView/HistoryBetList";
import { BetDirection, BetResult, BetStatus } from "@/domain/bets";

vi.mock("@/components/HistoryView/HistoryBetChart", () => ({
  HistoryBetChart: ({ bet }: { bet: ResolvedBet }) => (
    <div>Chart for {bet.betId}</div>
  ),
}));

afterEach(cleanup);

const bet: ResolvedBet = {
  betId: "bet-1",
  playerId: "player-1",
  product: "BTC-USD",
  direction: BetDirection.Up,
  status: BetStatus.Resolved,
  result: BetResult.Won,
  startPrice: "100",
  endPrice: "101",
  startEventTimestamp: "2026-08-21T12:00:00.000Z",
  resolutionTargetTimestamp: "2026-08-21T12:01:00.000Z",
  endEventTimestamp: "2026-08-21T12:01:00.250Z",
  createdAt: "2026-08-21T12:00:00.100Z",
};

test("requests selection and renders the chart only for the expanded bet", () => {
  const onSelect = vi.fn();
  const view = render(
    <HistoryBetList
      bets={[bet]}
      olderCount={2}
      selectedBetId={null}
      onSelect={onSelect}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Show price chart" }));
  expect(onSelect).toHaveBeenCalledWith("bet-1");
  expect(screen.queryByText("Chart for bet-1")).toBeNull();
  expect(screen.getByText("…and 2 older bets.")).toBeTruthy();

  view.rerender(
    <HistoryBetList
      bets={[bet]}
      olderCount={2}
      selectedBetId="bet-1"
      onSelect={onSelect}
    />,
  );
  expect(screen.getByText("Chart for bet-1")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Hide price chart" })).toBeTruthy();
});
