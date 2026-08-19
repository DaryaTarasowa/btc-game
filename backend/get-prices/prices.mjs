export const PRICE_HISTORY_WINDOW_MS = 3 * 60 * 1000;

function toSourceTimestamp(date) {
  return date.toISOString().replace("Z", "000Z");
}

export function createPriceWindow(now = new Date()) {
  return {
    start: toSourceTimestamp(new Date(now.getTime() - PRICE_HISTORY_WINDOW_MS)),
    end: toSourceTimestamp(now),
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
