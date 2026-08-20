import assert from "node:assert/strict";
import test from "node:test";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { BetRepository, type ActiveBet } from "./betRepository.js";

const activeBet: ActiveBet = {
  id: "bet-1",
  playerId: "player-1",
  recordKey: "ACTIVE",
  direction: "up",
  status: "active",
  startPrice: "100",
  startEventTimestamp: "2026-08-20T12:00:00.000Z",
  resolutionTargetTimestamp: "2026-08-20T12:01:00.000Z",
  createdAt: "2026-08-20T12:00:00.100Z",
};

test("queries active bets through the resolution-target GSI", async () => {
  const commands: unknown[] = [];
  const client = {
    send: async (command: unknown) => {
      commands.push(command);
      return { Items: [activeBet] };
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", client);

  assert.deepEqual(
    await repository.queryActiveThrough("2026-08-20T12:01:05.000000000Z"),
    [activeBet],
  );
  assert.ok(commands[0] instanceof QueryCommand);
  assert.equal(commands[0].input.IndexName, "status-resolution-target-index");
  assert.match(commands[0].input.KeyConditionExpression ?? "", /<= :upperBound/);
});

test("atomically moves an active bet to resolved history", async () => {
  let command: unknown;
  const client = {
    send: async (value: unknown) => {
      command = value;
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", client);

  assert.equal(
    await repository.resolveBetConditionally(activeBet, {
      endPrice: "101",
      endEventTimestamp: "2026-08-20T12:01:00.100Z",
      result: "won",
    }),
    "resolved",
  );
  assert.ok(command instanceof TransactWriteCommand);
  const [deletion, history] = command.input.TransactItems ?? [];
  assert.equal(deletion?.Delete?.ConditionExpression, "#status = :active AND #id = :id");
  assert.deepEqual(history?.Put?.Item, {
    ...activeBet,
    recordKey: `BET#${activeBet.startEventTimestamp}#${activeBet.id}`,
    status: "resolved",
    endPrice: "101",
    endEventTimestamp: "2026-08-20T12:01:00.100Z",
    result: "won",
  });
});

test("a failed active condition is treated as already resolved", async () => {
  const client = {
    send: async () => {
      const error = new Error("cancelled") as Error & {
        CancellationReasons: Array<{ Code: string }>;
      };
      error.name = "TransactionCanceledException";
      error.CancellationReasons = [{ Code: "ConditionalCheckFailed" }];
      throw error;
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", client);

  assert.equal(
    await repository.resolveBetConditionally(activeBet, {
      endPrice: "101",
      endEventTimestamp: "2026-08-20T12:01:00.100Z",
      result: "won",
    }),
    "already_resolved",
  );
});
