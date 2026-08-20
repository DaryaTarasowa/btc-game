import assert from "node:assert/strict";
import test from "node:test";
import { claimsFrom, validUsername } from "./players.mjs";

test("reads the authenticated Cognito subject and email", () => {
  const claims = { sub: "subject-1", email: "player@example.test" };
  assert.equal(claimsFrom({ requestContext: { authorizer: { jwt: { claims } } } }), claims);
});

test("rejects requests without both required JWT claims", () => {
  assert.throws(() => claimsFrom({}), /claims are missing/);
  assert.throws(
    () => claimsFrom({ requestContext: { authorizer: { jwt: { claims: { sub: "subject-1" } } } } }),
    /claims are missing/,
  );
});

test("normalizes valid local and Unicode usernames", () => {
  assert.equal(validUsername("  Darya_1  "), "Darya_1");
  assert.equal(validUsername("Élodie Иван"), "Élodie Иван");
});

test("rejects invalid usernames", () => {
  for (const value of [undefined, "a", "a".repeat(33), "player@email", "player/slash", "line\nbreak"]) {
    assert.equal(validUsername(value), null);
  }
});
