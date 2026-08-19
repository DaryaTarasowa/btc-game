import assert from "node:assert/strict";
import test from "node:test";
import { BetCreationError, createBet } from "./bets.mjs";

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
  const dependencies = {
    createId: () => "bet-id",
    now: () => new Date("2026-08-20T12:35:00.000Z"),
    async getHistoryPoint(product, timestamp) {
      assert.equal(product, "BTC-USD");
      assert.equal(timestamp, POINT.timestamp);
      return historyExists ? { price: storedPrice } : undefined;
    },
    async putActiveBet(bet) {
      await Promise.resolve();
      if (activeBet) {
        const error = new Error("duplicate");
        error.name = "ConditionalCheckFailedException";
        throw error;
      }
      activeBet = bet;
    },
    isDuplicateError: (error) => error?.name === "ConditionalCheckFailedException",
  };
  return { dependencies, get activeBet() { return activeBet; } };
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
  assert.deepEqual(state.activeBet, bet);
});

test("creates a valid DOWN bet", async () => {
  const state = harness();
  const bet = await createBet(request({ direction: "down" }), state.dependencies);
  assert.equal(bet.direction, "down");
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
