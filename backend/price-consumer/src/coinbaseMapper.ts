import type { MarketPriceEventData } from "./types.js";

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

export function getMessageType(value: unknown): string | null {
  return isRecord(value) && typeof value.type === "string" ? value.type : null;
}

export function normalizeCoinbaseMessage(
  value: unknown,
  receivedTimestamp: string,
): MarketPriceEventData | null {
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
    product: "BTC-USD",
    price: value.price,
    eventTimestamp: value.time,
    receivedTimestamp,
    ...(typeof value.sequence === "number" &&
    Number.isSafeInteger(value.sequence)
      ? { sequence: value.sequence }
      : {}),
    ...(typeof value.trade_id === "number" &&
    Number.isSafeInteger(value.trade_id)
      ? { tradeId: value.trade_id }
      : {}),
  };
}
