import assert from "node:assert/strict";
import test from "node:test";
import { BetCreationError, createBet, createBetTransaction } from "./bets.mjs";

const PLAYER_ID = "550e8400-e29b-41d4-a716-446655440000";
const POINT = {
  price: "113245.37",
  timestamp: "2026-08-20T12:34:56.123456Z",
};

function request(overrides = {}) {
  return {
    playerId: PLAYER_ID,
    direction: "up",
    startPrice: POINT.price,
    startEventTimestamp: POINT.timestamp,
    ...overrides,
  };
}

function harness({ storedPrice = POINT.price, historyExists = true } = {}) {
  let activeBet;
  let activeBetId;
  const dependencies = {
    createId: () => "bet-id",
    now: () => new Date("2026-08-20T12:35:00.000Z"),
    async getHistoryPoint(product, timestamp) {
      assert.equal(product, "BTC-USD");
      assert.equal(timestamp, POINT.timestamp);
      return historyExists ? { price: storedPrice } : undefined;
    },
    async transactCreateBet(bet) {
      await Promise.resolve();
      if (activeBetId) {
        const error = new Error("duplicate");
        error.name = "TransactionCanceledException";
        throw error;
      }
      activeBet = bet;
      activeBetId = bet.betId;
    },
    isDuplicateError: (error) => error?.name === "TransactionCanceledException",
  };
  return { dependencies, get activeBet() { return activeBet; }, get activeBetId() { return activeBetId; } };
}

async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof BetCreationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("creates a valid UP bet from the exact visible history point", async () => {
  const state = harness();
  const bet = await createBet(request(), state.dependencies);
  assert.equal(bet.direction, "up");
  assert.equal(bet.startPrice, POINT.price);
  assert.equal(bet.startEventTimestamp, POINT.timestamp);
  assert.equal(bet.betId, "bet-id");
  assert.deepEqual(state.activeBet, bet);
  assert.equal(state.activeBetId, bet.betId);
});

test("creation transaction atomically puts the stable bet and claims the player", () => {
  const bet = {
    betId: "bet-id",
    playerId: PLAYER_ID,
    status: "active",
  };
  assert.deepEqual(createBetTransaction(bet, "bets", "players"), {
    TransactItems: [
      {
        Put: {
          TableName: "bets",
          Item: bet,
          ConditionExpression: "attribute_not_exists(playerId) AND attribute_not_exists(betId)",
        },
      },
      {
        Update: {
          TableName: "players",
          Key: { playerId: PLAYER_ID },
          UpdateExpression: "SET activeBetId = :betId",
          ConditionExpression: "attribute_exists(playerId) AND attribute_not_exists(activeBetId)",
          ExpressionAttributeValues: { ":betId": "bet-id" },
        },
      },
    ],
  });
});

test("creates a valid DOWN bet", async () => {
  const state = harness();
  const bet = await createBet(request({ direction: "down" }), state.dependencies);
  assert.equal(bet.direction, "down");
});

test("accepts a Cognito subject that is UUID-shaped but not an RFC UUID", async () => {
  const bet = await createBet(
    request({ playerId: "00000000-0000-0000-0000-000000000000" }),
    harness().dependencies,
  );
  assert.equal(bet.playerId, "00000000-0000-0000-0000-000000000000");
});

test("resolution target is exactly 60 seconds after source time with precision preserved", async () => {
  const bet = await createBet(request(), harness().dependencies);
  assert.equal(bet.resolutionTargetTimestamp, "2026-08-20T12:35:56.123456Z");
});

test("rejects a nonexistent timestamp", async () => {
  await rejectsWithCode(createBet(request(), harness({ historyExists: false }).dependencies), "history_point_not_found");
});

test("rejects a stored timestamp whose price differs", async () => {
  await rejectsWithCode(createBet(request(), harness({ storedPrice: "113245.38" }).dependencies), "history_price_mismatch");
});

for (const [name, overrides, code] of [
  ["malformed direction", { direction: "sideways" }, "invalid_direction"],
  ["malformed price", { startPrice: "113,245.37" }, "invalid_start_price"],
  ["zero price", { startPrice: "0" }, "invalid_start_price"],
  ["malformed timestamp", { startEventTimestamp: "yesterday" }, "invalid_start_timestamp"],
  ["missing playerId", { playerId: undefined }, "invalid_player_id"],
]) {
  test(`rejects ${name}`, async () => {
    await rejectsWithCode(createBet(request(overrides), harness().dependencies), code);
  });
}

test("rejects a duplicate active bet", async () => {
  const state = harness();
  await createBet(request(), state.dependencies);
  await rejectsWithCode(createBet(request(), state.dependencies), "active_bet_exists");
});

test("concurrent duplicate creation cannot produce two active bets", async () => {
  const state = harness();
  const results = await Promise.allSettled([
    createBet(request(), state.dependencies),
    createBet(request({ direction: "down" }), state.dependencies),
  ]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(results.find(({ status }) => status === "rejected").reason.code, "active_bet_exists");
});
