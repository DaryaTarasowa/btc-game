import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "./index.mjs";

test("auto-confirms and verifies a Cognito sign-up while preserving the event", async () => {
  const event = { userName: "subject-1", response: { custom: "preserved" } };
  assert.deepEqual(await handler(event), {
    userName: "subject-1",
    response: { custom: "preserved", autoConfirmUser: true, autoVerifyEmail: true },
  });
});
