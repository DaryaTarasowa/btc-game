export const PRICE_HISTORY_WINDOW_MS = 3 * 60 * 1000;
export const PRICE_HISTORY_RETENTION_MS = 10 * 60 * 60 * 1000;

function toSourceTimestamp(date) {
  return date.toISOString().replace("Z", "000Z");
}

function normalizeRequestedTimestamp(value) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return null;
  return `${match[1]}.${(match[2] ?? "").padEnd(6, "0")}Z`;
}

export function createPriceWindow(now = new Date()) {
  return {
    start: toSourceTimestamp(new Date(now.getTime() - PRICE_HISTORY_WINDOW_MS)),
    end: toSourceTimestamp(now),
  };
}

export function requestedPriceWindow(query = {}, now = new Date()) {
  const { start, end } = query;
  if (start === undefined && end === undefined) return createPriceWindow(now);
  if (typeof start !== "string" || typeof end !== "string") return null;

  const normalizedStart = normalizeRequestedTimestamp(start);
  const normalizedEnd = normalizeRequestedTimestamp(end);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (
    !normalizedStart ||
    !normalizedEnd ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime > endTime ||
    endTime - startTime > PRICE_HISTORY_RETENTION_MS
  ) return null;

  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

export function toPriceResponse(items = []) {
  const prices = items
    .filter(
      (item) =>
        typeof item?.price === "string" &&
        typeof item?.sourceTimestamp === "string",
    )
    .map((item) => ({
      price: item.price,
      eventTimestamp: item.sourceTimestamp,
    }))
    .sort((left, right) =>
      left.eventTimestamp.localeCompare(right.eventTimestamp),
    );

  return { prices };
}
