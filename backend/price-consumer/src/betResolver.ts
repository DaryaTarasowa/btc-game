import type { ActiveBet, BetResolution, BetStore } from "./betRepository.js";
import type { MarketPriceEventData } from "./types.js";
import {
  toEpochNanoseconds,
  type LogLevel,
  compareDecimal,
  queryTimestamp,
} from "./utils.js";

const DEFAULT_RELOAD_INTERVAL_MS = 1_000;
const DEFAULT_LOOKAHEAD_MS = 5_000;

type Logger = (
  level: LogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

interface BetResolverSettings {
  /** How often active bets are loaded from the repository. */
  reloadIntervalMs?: number;

  /**
   * How far beyond the current time the resolver preloads active bets.
   * This ensures bets approaching their resolution time are already present
   * in the in-memory working set when the relevant market event arrives.
   */
  lookaheadMs?: number;

  /** Injectable clock used primarily for deterministic testing. */
  now?: () => Date;

  /** Injectable timer functions used primarily for testing. */
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
}

export class BetResolver {
  private readonly activeBetsById = new Map<string, ActiveBet>();

  // Retains the first eligible resolution until it is successfully persisted,
  // so a failed write can be retried without using a later market event.
  private readonly retainedResolutions = new Map<string, BetResolution>();

  private readonly betsBeingResolved = new Set<string>();

  // Repository writes that must finish before shutdown.
  private readonly inFlightWrites = new Set<Promise<void>>();
  private readonly reloadIntervalMs: number;
  private readonly lookaheadMs: number;
  private readonly now: () => Date;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private latestMarketEventMs: number | undefined;
  private reloadTimer: ReturnType<typeof setInterval> | undefined;
  private reloadInFlight: Promise<void> | undefined;

  private stopping = false;

  public constructor(
    private readonly repository: BetStore,
    private readonly log: Logger,
    settings: BetResolverSettings = {},
  ) {
    this.reloadIntervalMs =
      settings.reloadIntervalMs ?? DEFAULT_RELOAD_INTERVAL_MS;
    this.lookaheadMs = settings.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    this.now = settings.now ?? (() => new Date());
    this.setIntervalFn = settings.setInterval ?? setInterval;
    this.clearIntervalFn = settings.clearInterval ?? clearInterval;
  }

  public async start(): Promise<void> {
    await this.reload();
    if (this.stopping) return;
    this.reloadTimer = this.setIntervalFn(
      () => void this.reload(),
      this.reloadIntervalMs,
    );
    this.reloadTimer.unref?.();
  }

  public reload(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.reloadInFlight) return this.reloadInFlight;

    // Use the market time if it is ahead of the system clock.
    const currentMs = Math.max(
      this.now().getTime(),
      this.latestMarketEventMs ?? 0,
    );
    const operation = this.repository
      .queryActiveThrough(
        queryTimestamp(new Date(currentMs + this.lookaheadMs)),
      )
      .then((activeBetsDue) => {
        for (const bet of activeBetsDue) this.activeBetsById.set(bet.betId, bet);

        // Recovery only: retry resolutions whose previous write failed.
        if (this.retainedResolutions.size > 0) {
          this.retryRetainedResolutions();
        }
      })
      .catch((error: unknown) => {
        this.log("error", "bet_reload_failed", {
          message:
            error instanceof Error ? error.message : "Unknown DynamoDB error",
        });
      })
      .finally(() => {
        this.reloadInFlight = undefined;
      });
    this.reloadInFlight = operation;
    return operation;
  }

  private shouldResolve(bet: ActiveBet, event: MarketPriceEventData): boolean {
    const eventTime = toEpochNanoseconds(event.eventTimestamp);
    const targetTime = toEpochNanoseconds(bet.resolutionTargetTimestamp);

    const targetReached = eventTime >= targetTime;
    const priceChanged = compareDecimal(event.price, bet.startPrice) !== 0;

    return targetReached && priceChanged;
  }

  // Returns true if the event caused any bets to be scheduled for resolution, false otherwise.
  public process(event: MarketPriceEventData): boolean {
    if (this.stopping) return false;

    this.latestMarketEventMs = Math.max(
      this.latestMarketEventMs ?? 0,
      Date.parse(event.eventTimestamp),
    );

    let resolutionScheduled = false;

    for (const bet of this.activeBetsById.values()) {
      if (this.shouldResolve(bet, event)) {
        const existingResolution = this.retainedResolutions.get(bet.betId);
        const comparison = compareDecimal(event.price, bet.startPrice);

        const resolution: BetResolution = existingResolution ?? {
          endPrice: event.price,
          endEventTimestamp: event.eventTimestamp,
          result:
            bet.direction === "up"
              ? comparison > 0
                ? "won"
                : "lost"
              : comparison < 0
                ? "won"
                : "lost",
        };

        this.retainedResolutions.set(bet.betId, resolution);

        const scheduled = this.scheduleResolution(bet, resolution);
        if (!existingResolution && scheduled) {
          // we use exactly this event for the resolution
          resolutionScheduled = true;
        }
      }
    }

    return resolutionScheduled;
  }

  private retryRetainedResolutions(): void {
    for (const [id, resolution] of this.retainedResolutions) {
      const bet = this.activeBetsById.get(id);
      if (bet) this.scheduleResolution(bet, resolution);
    }
  }

  private scheduleResolution(
    bet: ActiveBet,
    resolution: BetResolution,
  ): boolean {
    if (this.betsBeingResolved.has(bet.betId) || this.stopping) return false;
    this.betsBeingResolved.add(bet.betId);
    const operation = this.repository
      .resolveBetConditionally(bet, resolution)
      .then((result) => {
        this.activeBetsById.delete(bet.betId);
        this.retainedResolutions.delete(bet.betId);
        this.log("info", "bet_resolved", {
          betId: bet.betId,
          playerId: bet.playerId,
          result,
          endEventTimestamp: resolution.endEventTimestamp,
        });
      })
      .catch((error: unknown) => {
        this.log("error", "bet_resolution_failed", {
          betId: bet.betId,
          playerId: bet.playerId,
          message:
            error instanceof Error ? error.message : "Unknown DynamoDB error",
        });
      })
      .finally(() => {
        this.betsBeingResolved.delete(bet.betId);
        this.inFlightWrites.delete(operation);
      });
    this.inFlightWrites.add(operation);
    return true;
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    if (this.reloadTimer) this.clearIntervalFn(this.reloadTimer);
    await this.reloadInFlight;
    await Promise.all(this.inFlightWrites);
  }
}
