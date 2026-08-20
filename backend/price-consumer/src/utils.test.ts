import assert from "node:assert/strict";
import test from "node:test";
import { toEpochMilliseconds, toEpochNanoseconds } from "./utils.js";

test("converts ISO timestamps to epoch milliseconds", () => {
  assert.equal(toEpochMilliseconds("1970-01-01T00:00:01.250Z"), 1_250);
  assert.throws(() => toEpochMilliseconds("not-a-date"), /Invalid timestamp/);
});

test("preserves source precision up to nanoseconds", () => {
  assert.equal(toEpochNanoseconds("1970-01-01T00:00:01Z"), 1_000_000_000n);
  assert.equal(toEpochNanoseconds("1970-01-01T00:00:01.2Z"), 1_200_000_000n);
  assert.equal(toEpochNanoseconds("1970-01-01T00:00:01.123456789Z"), 1_123_456_789n);
});

test("rejects non-UTC and over-precise timestamps", () => {
  assert.throws(() => toEpochNanoseconds("2026-08-20T12:00:00+02:00"), /Invalid UTC timestamp/);
  assert.throws(() => toEpochNanoseconds("2026-08-20T12:00:00.1234567890Z"), /Invalid UTC timestamp/);
});
