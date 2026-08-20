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
    id: "bet-1",
    playerId: "player-1",
    recordKey: "ACTIVE",
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
  public readonly resolutions: Array<{ bet: ActiveBet; resolution: BetResolution }> = [];
  public queryCount = 0;
  public resolutionResult: ResolutionWriteResult = "resolved";

  public async queryActiveThrough(): Promise<ActiveBet[]> {
    this.queryCount += 1;
    return this.active;
  }

  public async resolveBetConditionally(
    activeBet: ActiveBet,
    resolution: BetResolution,
  ): Promise<ResolutionWriteResult> {
    this.resolutions.push({ bet: activeBet, resolution });
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
  await value.refresh();
  return value;
}

test("event before target does not resolve", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);
  value.process(event("101", "2026-08-20T12:00:59.999Z"));
  await value.stop();
  assert.equal(repository.resolutions.length, 0);
});

test("event exactly at target with different price resolves", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);
  value.process(event("101", TARGET));
  await value.stop();
  assert.equal(repository.resolutions[0]?.resolution.endEventTimestamp, TARGET);
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
  await value.stop();
  assert.equal(repository.resolutions.length, 1);
});

test("refresh discovers a newly created bet", async () => {
  const repository = new FakeRepository();
  const value = resolver(repository);
  await value.refresh();
  repository.active = [bet()];
  await value.refresh();
  value.process(event("101", TARGET));
  await value.stop();
  assert.equal(repository.resolutions.length, 1);
});

test("a new resolver rebuilds its working set after restart", async () => {
  const repository = new FakeRepository();
  repository.active = [bet()];
  const restarted = resolver(repository);
  await restarted.refresh();
  restarted.process(event("101", TARGET));
  await restarted.stop();
  assert.equal(repository.resolutions.length, 1);
});

test("processing raw events does not query DynamoDB", async () => {
  const repository = new FakeRepository();
  const value = await load(repository);
  const queriesAfterRefresh = repository.queryCount;
  value.process(event("100", "2026-08-20T12:00:59.700Z"));
  value.process(event("101", TARGET));
  await value.stop();
  assert.equal(repository.queryCount, queriesAfterRefresh);
});
