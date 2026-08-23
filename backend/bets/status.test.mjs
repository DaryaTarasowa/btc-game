import assert from "node:assert/strict";
import test from "node:test";
import { betStatusKey, resolvedBetsQuery, sortResolvedBets } from "./status.mjs";

test("status lookup is restricted to the authenticated player's partition", () => {
  assert.deepEqual(betStatusKey("authenticated-player", "bet-1"), {
    playerId: "authenticated-player",
    betId: "bet-1",
  });
});

test("status lookup rejects malformed bet IDs", () => {
  assert.equal(betStatusKey("authenticated-player", "../other-player"), null);
});

test("status lookup accepts boundary-safe IDs and rejects empty or oversized IDs", () => {
  assert.ok(betStatusKey("authenticated-player", "A".repeat(128)));
  assert.equal(betStatusKey("authenticated-player", ""), null);
  assert.equal(betStatusKey("authenticated-player", "A".repeat(129)), null);
  assert.equal(betStatusKey("authenticated-player", "contains_underscore"), null);
});

test("history lists only resolved records for the authenticated player newest first", () => {
  assert.deepEqual(resolvedBetsQuery("authenticated-player"), {
    KeyConditionExpression: "playerId = :playerId",
    FilterExpression: "#status = :resolved",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":playerId": "authenticated-player",
      ":resolved": "resolved",
    },
    ConsistentRead: true,
  });
});

test("history explicitly orders stable-key bets by creation time newest first", () => {
  const older = { betId: "z-random", createdAt: "2026-08-20T12:00:00.000Z" };
  const newer = { betId: "a-random", createdAt: "2026-08-20T12:01:00.000Z" };
  assert.deepEqual(sortResolvedBets([older, newer]), [newer, older]);
});
