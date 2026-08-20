import type {
  ActiveBet,
  BetResolution,
  BetStore,
} from "./betRepository.js";
import type { MarketPriceEventData } from "./types.js";
import { toEpochNanoseconds, type LogLevel } from "./utils.js";

const DEFAULT_REFRESH_INTERVAL_MS = 1_000;
const DEFAULT_LOOKAHEAD_MS = 5_000;

type Logger = (
  level: LogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

interface BetResolverSettings {
  refreshIntervalMs?: number;
  lookaheadMs?: number;
  now?: () => Date;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
}

function queryTimestamp(date: Date): string {
  return date.toISOString().replace("Z", "000000Z");
}

function normalizedDecimal(value: string): { whole: string; fraction: string } {
  const [wholePart = "0", fractionPart = ""] = value.split(".");
  return {
    whole: wholePart.replace(/^0+(?=\d)/, ""),
    fraction: fractionPart.replace(/0+$/, ""),
  };
}

export function compareDecimal(left: string, right: string): number {
  const a = normalizedDecimal(left);
  const b = normalizedDecimal(right);
  if (a.whole.length !== b.whole.length) return a.whole.length > b.whole.length ? 1 : -1;
  if (a.whole !== b.whole) return a.whole > b.whole ? 1 : -1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const aFraction = a.fraction.padEnd(width, "0");
  const bFraction = b.fraction.padEnd(width, "0");
  return aFraction === bFraction ? 0 : aFraction > bFraction ? 1 : -1;
}

export class BetResolver {
  private readonly workingSet = new Map<string, ActiveBet>();
  private readonly candidates = new Map<string, BetResolution>();
  private readonly resolving = new Set<string>();
  private readonly pending = new Set<Promise<void>>();
  private readonly refreshIntervalMs: number;
  private readonly lookaheadMs: number;
  private readonly now: () => Date;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private latestMarketEventMs: number | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private refreshInFlight: Promise<void> | undefined;
  private stopping = false;

  public constructor(
    private readonly repository: BetStore,
    private readonly log: Logger,
    settings: BetResolverSettings = {},
  ) {
    this.refreshIntervalMs = settings.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.lookaheadMs = settings.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    this.now = settings.now ?? (() => new Date());
    this.setIntervalFn = settings.setInterval ?? setInterval;
    this.clearIntervalFn = settings.clearInterval ?? clearInterval;
  }

  public async start(): Promise<void> {
    await this.refresh();
    if (this.stopping) return;
    this.refreshTimer = this.setIntervalFn(() => void this.refresh(), this.refreshIntervalMs);
    this.refreshTimer.unref?.();
  }

  public refresh(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.refreshInFlight) return this.refreshInFlight;

    const currentMs = Math.max(this.now().getTime(), this.latestMarketEventMs ?? 0);
    const operation = this.repository
      .queryActiveThrough(queryTimestamp(new Date(currentMs + this.lookaheadMs)))
      .then((bets) => {
        for (const bet of bets) this.workingSet.set(bet.id, bet);
        for (const [id, resolution] of this.candidates) {
          const bet = this.workingSet.get(id);
          if (bet) this.scheduleResolution(bet, resolution);
        }
      })
      .catch((error: unknown) => {
        this.log("error", "bet_refresh_failed", {
          message: error instanceof Error ? error.message : "Unknown DynamoDB error",
        });
      })
      .finally(() => {
        this.refreshInFlight = undefined;
      });
    this.refreshInFlight = operation;
    return operation;
  }

  public process(event: MarketPriceEventData): void {
    if (this.stopping) return;
    this.latestMarketEventMs = Math.max(
      this.latestMarketEventMs ?? 0,
      Date.parse(event.eventTimestamp),
    );
    const eventTime = toEpochNanoseconds(event.eventTimestamp);

    for (const bet of this.workingSet.values()) {
      if (eventTime < toEpochNanoseconds(bet.resolutionTargetTimestamp)) continue;
      const comparison = compareDecimal(event.price, bet.startPrice);
      if (comparison === 0) continue;

      const resolution: BetResolution = this.candidates.get(bet.id) ?? {
        endPrice: event.price,
        endEventTimestamp: event.eventTimestamp,
        result:
          bet.direction === "up"
            ? comparison > 0 ? "won" : "lost"
            : comparison < 0 ? "won" : "lost",
      };
      this.candidates.set(bet.id, resolution);
      this.scheduleResolution(bet, resolution);
    }
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    if (this.refreshTimer) this.clearIntervalFn(this.refreshTimer);
    await this.refreshInFlight;
    await Promise.all(this.pending);
  }

  private scheduleResolution(bet: ActiveBet, resolution: BetResolution): void {
    if (this.resolving.has(bet.id) || this.stopping) return;
    this.resolving.add(bet.id);
    const operation = this.repository
      .resolveBetConditionally(bet, resolution)
      .then((result) => {
        this.workingSet.delete(bet.id);
        this.candidates.delete(bet.id);
        this.log("info", "bet_resolved", {
          betId: bet.id,
          playerId: bet.playerId,
          result,
          endEventTimestamp: resolution.endEventTimestamp,
        });
      })
      .catch((error: unknown) => {
        this.log("error", "bet_resolution_failed", {
          betId: bet.id,
          playerId: bet.playerId,
          message: error instanceof Error ? error.message : "Unknown DynamoDB error",
        });
      })
      .finally(() => {
        this.resolving.delete(bet.id);
        this.pending.delete(operation);
      });
    this.pending.add(operation);
  }
}
