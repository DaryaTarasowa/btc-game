import { ReactNode, RefObject } from "react";
import type { MarketPrice } from "@/api/prices";
import {
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";

export interface PriceChartReferenceLine {
  price: string;
  label: string;
  color: string;
}

export interface PriceChartGuide {
  timestamp: string;
  price?: string;
  color: string;
}

export interface PriceChartRange {
  from: string;
  to: string;
}

export type PriceChartTone = "positive" | "negative" | "neutral";

export interface PriceChartAnnotation {
  text: ReactNode;
  color: string;
}

export const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export const toUnixTimestamp = (timestamp: string): UTCTimestamp => {
  return Math.floor(Date.parse(timestamp) / 1_000) as UTCTimestamp;
};

/**
 * Converts market prices into one chart point per whole second.
 *
 * If multiple prices fall into the same second, the latest one is used unless
 * one of the exact event timestamps is listed in `priorityTimestamps`.
 * Priority timestamps are useful for preserving important events such as
 * bet start or resolution prices when another sample exists in the same second.
 */
export function toChartData(
  prices: MarketPrice[],
  priorityTimestamps: string[] = [],
) {
  const pointsBySecond = new Map<number, MarketPrice>();
  const priority = new Set(priorityTimestamps);

  for (const price of prices) {
    const second = toUnixTimestamp(price.eventTimestamp);
    const existing = pointsBySecond.get(second);

    const shouldReplace =
      !existing ||
      priority.has(price.eventTimestamp) ||
      !priority.has(existing.eventTimestamp);

    if (shouldReplace) {
      pointsBySecond.set(second, price);
    }
  }

  return [...pointsBySecond.entries()]
    .sort(([left], [right]) => left - right)
    .map(([time, price]) => ({
      time: time as UTCTimestamp,
      value: Number(price.price),
      eventTimestamp: price.eventTimestamp,
    }));
}

export const toPriceLineOptions = (lines: PriceChartReferenceLine[]) => {
  return lines.map((line) => ({
    price: Number(line.price),
    color: line.color,
    lineWidth: 1 as const,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: line.label,
  }));
};

/**
 * Adds an empty point at the end of the visible range when no real market
 * point exists there yet.
 *
 * This is used for active bets whose chart range extends into the future
 * up to the resolution target. The added point has no price and only makes
 * Lightweight Charts render the full requested time range.
 */
export function extendSeriesToRangeEnd(
  seriesData: Array<{ time: UTCTimestamp; value?: number }>,
  visibleRange?: PriceChartRange,
) {
  if (!visibleRange) return seriesData;

  const rangeEnd = toUnixTimestamp(visibleRange.to);

  if (seriesData.some(({ time }) => time === rangeEnd)) {
    return seriesData;
  }

  return [...seriesData, { time: rangeEnd }].sort(
    (left, right) => Number(left.time) - Number(right.time),
  );
}

// Moves the reference price lines to match the given prices
export function replaceReferencePriceLines(
  series: ISeriesApi<"Area">,
  linesRef: RefObject<IPriceLine[]>,
  options: ReturnType<typeof toPriceLineOptions>,
) {
  for (const line of linesRef.current) {
    series.removePriceLine(line);
  }

  const newLines = options.map((options) => series.createPriceLine(options));

  linesRef.current = newLines;
}

export function setPointPosition(
  ref: RefObject<HTMLDivElement | null>,
  x: number | null,
  y: number | null,
) {
  if (!ref.current || x === null || y === null) return;

  ref.current.style.left = `${x}px`;
  ref.current.style.top = `${y}px`;
}

export function setHorizontalPosition(
  ref: RefObject<HTMLDivElement | null>,
  x: number | null,
) {
  if (ref.current && x !== null) {
    ref.current.style.left = `${x}px`;
  }
}

/**
 * Positions a guide line at its timestamp and, when a price is provided,
 * positions its dot at the corresponding chart price coordinate.
 */
export function positionGuide(
  chart: IChartApi,
  series: ISeriesApi<"Area">,
  guide: PriceChartGuide | undefined,
  guideRef: RefObject<HTMLDivElement | null>,
  dotRef: RefObject<HTMLDivElement | null>,
) {
  if (!guide) return;

  const x = chart
    .timeScale()
    .timeToCoordinate(toUnixTimestamp(guide.timestamp));

  const y = guide.price ? series.priceToCoordinate(Number(guide.price)) : null;

  setHorizontalPosition(guideRef, x);
  setPointPosition(dotRef, x, y);
}
