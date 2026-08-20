import { expect, test } from "vitest";
import { isPlayerId } from "./players";

test("accepts a Cognito subject that is UUID-shaped but not an RFC UUID", () => {
  expect(isPlayerId("00000000-0000-0000-0000-000000000000")).toBe(true);
});

test("rejects unsafe player identity characters", () => {
  expect(isPlayerId("player/id?admin=true")).toBe(false);
});
