import assert from "node:assert/strict";
import test from "node:test";
import { betStatusQuery } from "./status.mjs";

test("status lookup is restricted to the authenticated player's partition", () => {
  const query = betStatusQuery("authenticated-player", "bet-1");
  assert.equal(query.ExpressionAttributeValues[":playerId"], "authenticated-player");
  assert.equal(query.ExpressionAttributeValues[":betId"], "bet-1");
  assert.equal(query.KeyConditionExpression, "playerId = :playerId");
});

test("status lookup rejects malformed bet IDs", () => {
  assert.equal(betStatusQuery("authenticated-player", "../other-player"), null);
});

test("status lookup accepts boundary-safe IDs and rejects empty or oversized IDs", () => {
  assert.ok(betStatusQuery("authenticated-player", "A".repeat(128)));
  assert.equal(betStatusQuery("authenticated-player", ""), null);
  assert.equal(betStatusQuery("authenticated-player", "A".repeat(129)), null);
  assert.equal(betStatusQuery("authenticated-player", "contains_underscore"), null);
});
