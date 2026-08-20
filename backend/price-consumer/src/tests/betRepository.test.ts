import assert from "node:assert/strict";
import test from "node:test";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { BetRepository, type ActiveBet } from "../betRepository.js";
import { BetDirection, BetResult, BetStatus, ResolutionWriteResult } from "../domain.js";

const activeBet: ActiveBet = {
  betId: "bet-1",
  playerId: "player-1",
  product: "BTC-USD",
  direction: BetDirection.Up,
  status: BetStatus.Active,
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
  const repository = new BetRepository("btc-game-bets", "btc-game-players", client);

  assert.deepEqual(
    await repository.queryActiveThrough("2026-08-20T12:01:05.000000000Z"),
    [activeBet],
  );
  assert.ok(commands[0] instanceof QueryCommand);
  assert.equal(commands[0].input.IndexName, "status-resolution-target-index");
  assert.match(commands[0].input.KeyConditionExpression ?? "", /<= :upperBound/);
});

test("atomically resolves the stable bet item and updates its player", async () => {
  let command: unknown;
  const client = {
    send: async (value: unknown) => {
      command = value;
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", "btc-game-players", client);

  assert.equal(
    await repository.resolveBetConditionally(activeBet, {
      endPrice: "101",
      endEventTimestamp: "2026-08-20T12:01:00.100Z",
      result: BetResult.Won,
    }),
    "resolved",
  );
  assert.ok(command instanceof TransactWriteCommand);
  const [betUpdate, scoreUpdate] = command.input.TransactItems ?? [];
  assert.deepEqual(betUpdate?.Update?.Key, {
    playerId: activeBet.playerId,
    betId: activeBet.betId,
  });
  assert.equal(betUpdate?.Update?.ConditionExpression, "#status = :active");
  assert.match(betUpdate?.Update?.UpdateExpression ?? "", /#status = :resolved/);
  assert.deepEqual(betUpdate?.Update?.ExpressionAttributeValues, {
    ":active": "active",
    ":resolved": "resolved",
    ":endPrice": "101",
    ":endEventTimestamp": "2026-08-20T12:01:00.100Z",
    ":result": "won",
  });
  assert.deepEqual(scoreUpdate?.Update, {
    TableName: "btc-game-players",
    Key: { playerId: activeBet.playerId },
    UpdateExpression: "REMOVE activeBetId ADD #score :scoreChange",
    ConditionExpression: "activeBetId = :id",
    ExpressionAttributeNames: { "#score": "score" },
    ExpressionAttributeValues: { ":id": activeBet.betId, ":scoreChange": 1 },
  });
});

test("a loss subtracts one point in the resolution transaction", async () => {
  let command: unknown;
  const client = {
    send: async (value: unknown) => {
      command = value;
      return {};
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", "btc-game-players", client);

  await repository.resolveBetConditionally(activeBet, {
    endPrice: "99",
    endEventTimestamp: "2026-08-20T12:01:00.100Z",
    result: BetResult.Lost,
  });

  assert.ok(command instanceof TransactWriteCommand);
  assert.deepEqual(
    command.input.TransactItems?.[1]?.Update?.ExpressionAttributeValues,
    { ":id": activeBet.betId, ":scoreChange": -1 },
  );
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
  const repository = new BetRepository("btc-game-bets", "btc-game-players", client);

  assert.equal(
    await repository.resolveBetConditionally(activeBet, {
      endPrice: "101",
      endEventTimestamp: "2026-08-20T12:01:00.100Z",
      result: BetResult.Won,
    }),
    "already_resolved",
  );
});

test("a stale player activeBetId is treated as an already completed resolution", async () => {
  const client = {
    send: async () => {
      const error = new Error("cancelled") as Error & {
        CancellationReasons: Array<{ Code: string }>;
      };
      error.name = "TransactionCanceledException";
      error.CancellationReasons = [
        { Code: "None" },
        { Code: "ConditionalCheckFailed" },
      ];
      throw error;
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new BetRepository("btc-game-bets", "btc-game-players", client);

  assert.equal(
    await repository.resolveBetConditionally(activeBet, {
      endPrice: "101",
      endEventTimestamp: "2026-08-20T12:01:00.100Z",
      result: BetResult.Won,
    }),
    "already_resolved",
  );
});
