import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  LineStyle,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ActiveBet, ResolvedBet } from "@/api/bets";
import type { MarketPrice } from "@/api/prices";
import "@/components/PriceChart/PriceChart.css";

interface PriceChartProps {
  prices: MarketPrice[];
  bet?: ActiveBet | ResolvedBet | null;
  staticHistory?: boolean;
}

const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function toChartData(prices: MarketPrice[], authoritativeTimestamps: string[] = []) {
  const points = new Map<number, MarketPrice>();
  const authoritative = new Set(authoritativeTimestamps);

  for (const price of prices) {
    const time = Math.floor(Date.parse(price.eventTimestamp) / 1000);
    const existing = points.get(time);
    if (
      !existing ||
      authoritative.has(price.eventTimestamp) ||
      !authoritative.has(existing.eventTimestamp)
    ) {
      points.set(time, price);
    }
  }

  return [...points.entries()]
    .sort(([left], [right]) => left - right)
    .map(([time, price]) => ({
      time: time as UTCTimestamp,
      value: Number(price.price),
      eventTimestamp: price.eventTimestamp,
    }));
}

export function chartHeadlinePrice(
  prices: MarketPrice[],
  bet: ActiveBet | ResolvedBet | null | undefined,
  staticHistory: boolean,
): string | undefined {
  if (staticHistory && bet?.status === "resolved") return bet.endPrice;
  return prices.at(-1)?.price;
}

function resultColor(bet: ResolvedBet) {
  return bet.result === "won" ? "#35d59a" : "#ff6877";
}

export function betGraphColor(bet: ActiveBet | ResolvedBet) {
  return bet.direction === "up" ? "#35d59a" : "#ff6877";
}

export function staticGraphFillColors(bet: ResolvedBet) {
  return bet.direction === "up"
    ? { top: "rgba(53, 213, 154, 0.28)", bottom: "rgba(53, 213, 154, 0.015)" }
    : { top: "rgba(255, 104, 119, 0.28)", bottom: "rgba(255, 104, 119, 0.015)" };
}

export function referencePriceLineOptions(
  bet: ActiveBet | ResolvedBet | null | undefined,
  staticHistory: boolean,
) {
  if (!staticHistory || bet?.status !== "resolved") return [];
  const color = resultColor(bet);
  return [
    { price: Number(bet.startPrice), color, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Placed" },
    { price: Number(bet.endPrice), color, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Resolved" },
  ];
}

export function betGuideColors(bet: ActiveBet | ResolvedBet) {
  const annotationColor = bet.status === "resolved" ? resultColor(bet) : betGraphColor(bet);
  return {
    creation: annotationColor,
    resolution: bet.status === "resolved" ? annotationColor : null,
  };
}

export function PriceChart({ prices, bet, staticHistory = false }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const referencePriceLinesRef = useRef<IPriceLine[]>([]);
  const timestampsRef = useRef(new Map<number, string>());
  const creationGuideRef = useRef<HTMLDivElement>(null);
  const resolutionGuideRef = useRef<HTMLDivElement>(null);
  const resolutionDotRef = useRef<HTMLDivElement>(null);
  const betRef = useRef(bet);
  const staticHistoryRef = useRef(staticHistory);
  betRef.current = bet;
  staticHistoryRef.current = staticHistory;

  function positionHistoryGuides() {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const currentBet = betRef.current;
    if (!chart || !series || !staticHistoryRef.current || currentBet?.status !== "resolved") return;

    const creationX = chart.timeScale().timeToCoordinate(
      Math.floor(Date.parse(currentBet.startEventTimestamp) / 1_000) as UTCTimestamp,
    );
    const resolutionX = chart.timeScale().timeToCoordinate(
      Math.floor(Date.parse(currentBet.endEventTimestamp) / 1_000) as UTCTimestamp,
    );
    const resolutionY = series.priceToCoordinate(Number(currentBet.endPrice));

    if (creationGuideRef.current && creationX !== null) creationGuideRef.current.style.left = `${creationX}px`;
    if (resolutionGuideRef.current && resolutionX !== null) resolutionGuideRef.current.style.left = `${resolutionX}px`;
    if (resolutionDotRef.current && resolutionX !== null && resolutionY !== null) {
      resolutionDotRef.current.style.left = `${resolutionX}px`;
      resolutionDotRef.current.style.top = `${resolutionY}px`;
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 390,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8f9bb5",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.045)" },
        horzLines: { color: "rgba(255, 255, 255, 0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(247, 147, 26, 0.65)",
          labelBackgroundColor: "#f7931a",
        },
        horzLine: {
          color: "rgba(247, 147, 26, 0.4)",
          labelBackgroundColor: "#f7931a",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.12, bottom: 0.12 },
        autoScale: true,
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      localization: {
        priceFormatter: (price: number) => priceFormatter.format(price),
      },
      handleScale: { axisPressedMouseMove: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#f7a52b",
      topColor: "rgba(247, 147, 26, 0.34)",
      bottomColor: "rgba(247, 147, 26, 0.015)",
      lineWidth: 2,
      crosshairMarkerBackgroundColor: "#f7931a",
      crosshairMarkerBorderColor: "#fff2d9",
      priceLineColor: "#f7931a",
      priceLineWidth: 1,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    chart.subscribeCrosshairMove((parameter) => {
      const tooltip = tooltipRef.current;
      if (!tooltip || !parameter.point || !parameter.time) {
        if (tooltip) tooltip.hidden = true;
        return;
      }

      const data = parameter.seriesData.get(series);
      if (!data || !("value" in data)) {
        tooltip.hidden = true;
        return;
      }

      const unixTime = parameter.time as number;
      const timestamp = timestampsRef.current.get(unixTime);
      tooltip.innerHTML = `<strong>${priceFormatter.format(data.value)}</strong><span>${timeFormatter.format(new Date(timestamp ?? unixTime * 1000))}</span>`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(Math.max(parameter.point.x + 14, 8), container.clientWidth - tooltip.offsetWidth - 8)}px`;
      tooltip.style.top = `${Math.max(parameter.point.y - tooltip.offsetHeight - 14, 8)}px`;
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) {
        chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
        requestAnimationFrame(positionHistoryGuides);
      }
    });
    resizeObserver.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionHistoryGuides);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(positionHistoryGuides);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      referencePriceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const authoritativeTimestamps = staticHistory && bet?.status === "resolved"
      ? [bet.startEventTimestamp, bet.endEventTimestamp]
      : [];
    const chartData = toChartData(prices, authoritativeTimestamps);

    timestampsRef.current = new Map(
      chartData.map((point) => [point.time, point.eventTimestamp]),
    );

    series.setData(
      chartData.map(({ time, value }) => ({
        time,
        value,
      })),
    );

    const guideColors = bet ? betGuideColors(bet) : null;
    markersRef.current?.setMarkers(
      bet
        ? [{
            time: Math.floor(Date.parse(bet.startEventTimestamp) / 1_000) as UTCTimestamp,
            position: bet.direction === "up" ? "belowBar" : "aboveBar",
            color: staticHistory && guideColors ? guideColors.creation : betGraphColor(bet),
            shape: bet.direction === "up" ? "arrowUp" : "arrowDown",
            text: `${bet.direction.toUpperCase()} · $${Number(bet.startPrice).toLocaleString()}`,
          }]
        : [],
    );

    for (const line of referencePriceLinesRef.current) series.removePriceLine(line);
    const referenceLines = referencePriceLineOptions(bet, staticHistory);
    referencePriceLinesRef.current = referenceLines.map((line) => series.createPriceLine(line));
    const staticFill = staticHistory && bet?.status === "resolved" ? staticGraphFillColors(bet) : null;

    series.applyOptions({
      lineColor: bet
        ? betGraphColor(bet)
        : "#f7a52b",
      priceLineColor: bet
        ? betGraphColor(bet)
        : "#f7931a",
      priceLineVisible: referenceLines.length === 0,
      lastValueVisible: referenceLines.length === 0,
      topColor: staticFill?.top ?? "rgba(247, 147, 26, 0.34)",
      bottomColor: staticFill?.bottom ?? "rgba(247, 147, 26, 0.015)",
      crosshairMarkerBackgroundColor: staticHistory && bet ? betGraphColor(bet) : "#f7931a",
    });

    chart.timeScale().fitContent();
    const animationFrame = requestAnimationFrame(positionHistoryGuides);
    return () => cancelAnimationFrame(animationFrame);
  }, [bet, prices, staticHistory]);

  const headlinePrice = chartHeadlinePrice(prices, bet, staticHistory);
  const guideColors = bet ? betGuideColors(bet) : null;

  return (
    <section
      className={`price-chart${bet
        ? staticHistory && bet.status === "resolved"
          ? ` price-chart--resolved price-chart--${bet.result}`
          : ` price-chart--active price-chart--${bet.direction}`
        : ""}`}
      aria-label="BTC to USD price chart"
    >
      <header className="price-chart__header">
        <div>
          <p className="price-chart__symbol">
            <span aria-hidden="true">₿</span> BTC / USD
          </p>
          <p className="price-chart__window">{staticHistory ? "Stored bet window" : "Stored market history · 3 min"}</p>
          {bet && (
            <p className="price-chart__bet-state">
              <span aria-hidden="true" /> {bet.status === "resolved" ? `${bet.result.toUpperCase()} ${bet.direction.toUpperCase()} prediction` : `${bet.direction.toUpperCase()} position active`}
            </p>
          )}
        </div>
        <div className="price-chart__latest">
          <span>{staticHistory ? "Resolution price" : "Latest price"}</span>
          <strong>
            {headlinePrice ? priceFormatter.format(Number(headlinePrice)) : "—"}
          </strong>
        </div>
      </header>
      <div className="price-chart__canvas" ref={containerRef}>
        <div className="price-chart__tooltip" ref={tooltipRef} hidden />
        {staticHistory && bet?.status === "resolved" && guideColors && (
          <>
            <div
              className="price-chart__time-guide"
              ref={creationGuideRef}
              style={{ color: guideColors.creation }}
              aria-hidden="true"
            />
            <div
              className="price-chart__time-guide"
              ref={resolutionGuideRef}
              style={{ color: guideColors.resolution ?? undefined }}
              aria-hidden="true"
            />
            <div
              className="price-chart__resolution-dot"
              ref={resolutionDotRef}
              style={{ color: guideColors.resolution ?? undefined }}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </section>
  );
}
