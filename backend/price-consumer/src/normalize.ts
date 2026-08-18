import type { NormalizedPriceUpdate } from "./types.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveDecimal(value: string): boolean {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function messageType(value: unknown): string | null {
  return isRecord(value) && typeof value.type === "string" ? value.type : null;
}

export function normalizeCoinbaseMessage(
  value: unknown,
  receivedTimestamp: string,
): NormalizedPriceUpdate | null {
  if (!isRecord(value) || value.type !== "ticker") {
    return null;
  }

  if (
    value.product_id !== "BTC-USD" ||
    typeof value.price !== "string" ||
    !isPositiveDecimal(value.price) ||
    typeof value.time !== "string" ||
    !isTimestamp(value.time)
  ) {
    return null;
  }

  return {
    type: "price_update",
    source: "coinbase",
    product: "BTC-USD",
    price: value.price,
    sourceTimestamp: value.time,
    receivedTimestamp,
    ...(typeof value.sequence === "number" && Number.isSafeInteger(value.sequence)
      ? { sequence: value.sequence }
      : {}),
    ...(typeof value.trade_id === "number" && Number.isSafeInteger(value.trade_id)
      ? { tradeId: value.trade_id }
      : {}),
  };
}

export class LatestPriceSampler {
  private pendingUpdate: NormalizedPriceUpdate | undefined;
  private lastPrice: string | undefined;

  public add(update: NormalizedPriceUpdate): void {
    this.pendingUpdate = update;
  }

  public takeChanged(): NormalizedPriceUpdate | null {
    const update = this.pendingUpdate;
    this.pendingUpdate = undefined;

    if (!update || update.price === this.lastPrice) {
      return null;
    }

    this.lastPrice = update.price;
    return update;
  }
}
