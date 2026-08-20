import assert from "node:assert/strict";
import test from "node:test";
import type {
  ActiveBet,
  BetResolution,
  BetStore,
  ResolutionWriteResult,
} from "./betRepository.js";
import { BetResolver } from "./betResolver.js";
import type { MarketPriceEventData } from "./types.js";

const TARGET = "2026-08-20T12:01:00.000Z";

function bet(overrides: Partial<ActiveBet> = {}): ActiveBet {
  return {
    betId: "bet-1",
    playerId: "player-1",
    direction: "up",
    status: "active",
    startPrice: "100",
    startEventTimestamp: "2026-08-20T12:00:00.000Z",
    resolutionTargetTimestamp: TARGET,
    createdAt: "2026-08-20T12:00:00.100Z",
    ...overrides,
  };
}

function event(price: string, eventTimestamp: string): MarketPriceEventData {
  return {
    product: "BTC-USD",
    price,
    eventTimestamp,
    receivedTimestamp: eventTimestamp,
  };
}

class FakeRepository implements BetStore {
  public active: ActiveBet[] = [];

  public readonly resolutions: Array<{
    bet: ActiveBet;
    resolution: BetResolution;
  }> = [];

  public readonly resolutionAttempts: Array<{
    bet: ActiveBet;
    resolution: BetResolution;
  }> = [];

  public queryCount = 0;
  public resolutionResult: ResolutionWriteResult = "resolved";
  public resolutionFailuresRemaining = 0;

  public async queryActiveThrough(): Promise<ActiveBet[]> {
    this.queryCount += 1;
    return this.active;
  }

  public async resolveBetConditionally(
    activeBet: ActiveBet,
    resolution: BetResolution,
  ): Promise<ResolutionWriteResult> {
    this.resolutionAttempts.push({
      bet: activeBet,
      resolution,
    });

    if (this.resolutionFailuresRemaining > 0) {
      this.resolutionFailuresRemaining -= 1;
      throw new Error("Temporary DynamoDB failure");
    }

    this.resolutions.push({
      bet: activeBet,
      resolution,
    });

    return this.resolutionResult;
  }
}

function resolver(repository: FakeRepository) {
  return new BetResolver(repository, () => undefined, {
    now: () => new Date("2026-08-20T12:00:56.000Z"),
  });
}

async function load(repository: FakeRepository, activeBet = bet()) {
  repository.active = [activeBet];

  const value = resolver(repository);
  await value.reload();

  return value;
}

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

test("event before target does not resolve", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  assert.equal(value.process(event("101", "2026-08-20T12:00:59.999Z")), false);

  await value.stop();

  assert.equal(repository.resolutions.length, 0);
});

test("event exactly at target with different price resolves", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  assert.equal(value.process(event("101", TARGET)), true);

  await value.stop();

  assert.equal(repository.resolutions[0]?.resolution.endEventTimestamp, TARGET);
});

test("later events do not replace the first resolution", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  assert.equal(value.process(event("101", TARGET)), true);

  assert.equal(value.process(event("102", "2026-08-20T12:01:00.100Z")), false);

  await value.stop();

  assert.equal(repository.resolutions[0]?.resolution.endPrice, "101");
});

test("event after target with different price resolves", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  value.process(event("101", "2026-08-20T12:01:00.100Z"));

  await value.stop();

  assert.equal(repository.resolutions.length, 1);
});

test("same start price remains active until a later different price", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  value.process(event("100.00", "2026-08-20T12:01:00.100Z"));

  assert.equal(repository.resolutions.length, 0);

  value.process(event("99", "2026-08-20T12:01:01.000Z"));

  await value.stop();

  assert.equal(repository.resolutions[0]?.resolution.endPrice, "99");
});

test("comparison is against start price rather than the previous event", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  value.process(event("101", "2026-08-20T12:00:59.700Z"));

  value.process(event("101", "2026-08-20T12:01:00.100Z"));

  await value.stop();

  assert.deepEqual(repository.resolutions[0]?.resolution, {
    endPrice: "101",
    endEventTimestamp: "2026-08-20T12:01:00.100Z",
    result: "won",
  });
});

test("an UP bet loses when the exact resolution price is lower even if a later price rises", async () => {
  const repository = new FakeRepository();

  const value = await load(repository, bet({ startPrice: "71726.28" }));

  value.process(event("71724.9", TARGET));

  value.process(event("71729.76", "2026-08-20T12:01:05.000Z"));

  await value.stop();

  assert.deepEqual(repository.resolutions[0]?.resolution, {
    endPrice: "71724.9",
    endEventTimestamp: TARGET,
    result: "lost",
  });
});

for (const [direction, endPrice, result] of [
  ["up", "101", "won"],
  ["up", "99", "lost"],
  ["down", "99", "won"],
  ["down", "101", "lost"],
] as const) {
  test(`${direction.toUpperCase()} ${result}`, async () => {
    const repository = new FakeRepository();

    const value = await load(repository, bet({ direction }));

    value.process(event(endPrice, TARGET));

    await value.stop();

    assert.equal(repository.resolutions[0]?.resolution.result, result);
  });
}

test("conditional duplicate resolution is harmless", async () => {
  const repository = new FakeRepository();
  repository.resolutionResult = "already_resolved";

  const value = await load(repository);

  value.process(event("101", TARGET));

  await value.reload();
  await value.stop();

  assert.equal(repository.resolutions.length, 1);
});

test("reload discovers a newly created bet", async () => {
  const repository = new FakeRepository();
  const value = resolver(repository);

  await value.reload();

  repository.active = [bet()];

  await value.reload();

  value.process(event("101", TARGET));

  await value.stop();

  assert.equal(repository.resolutions.length, 1);
});

test("a new resolver rebuilds its active bets after restart", async () => {
  const repository = new FakeRepository();
  repository.active = [bet()];

  const restarted = resolver(repository);

  await restarted.reload();

  restarted.process(event("101", TARGET));

  await restarted.stop();

  assert.equal(repository.resolutions.length, 1);
});

test("processing market events does not query DynamoDB", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);

  const queriesAfterReload = repository.queryCount;

  value.process(event("100", "2026-08-20T12:00:59.700Z"));

  value.process(event("101", TARGET));

  await value.stop();

  assert.equal(repository.queryCount, queriesAfterReload);
});

test("failed resolution retries the original retained resolution", async () => {
  const repository = new FakeRepository();
  repository.resolutionFailuresRemaining = 1;

  const value = await load(repository);

  // This is the first eligible event and therefore establishes
  // the authoritative resolution.
  assert.equal(value.process(event("99", TARGET)), true);

  // A later event must not replace the original resolution.
  assert.equal(value.process(event("101", "2026-08-20T12:01:00.100Z")), false);

  // Let the first repository write fail.
  await waitForAsyncWork();

  assert.equal(repository.resolutions.length, 0);

  // reload() performs recovery and retries the retained resolution.
  await value.reload();
  await value.stop();

  assert.equal(repository.resolutionAttempts.length, 2);

  assert.equal(repository.resolutionAttempts[0]?.resolution.endPrice, "99");

  assert.equal(repository.resolutionAttempts[1]?.resolution.endPrice, "99");

  assert.deepEqual(repository.resolutions[0]?.resolution, {
    endPrice: "99",
    endEventTimestamp: TARGET,
    result: "lost",
  });
});
