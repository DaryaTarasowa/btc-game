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

export function toChartData(prices: MarketPrice[]) {
  const points = new Map<number, MarketPrice>();

  for (const price of prices) {
    const time = Math.floor(Date.parse(price.eventTimestamp) / 1000);
    points.set(time, price);
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

export function resolutionPriceLineOptions(
  bet: ActiveBet | ResolvedBet | null | undefined,
  staticHistory: boolean,
) {
  if (!staticHistory || bet?.status !== "resolved") return null;
  return {
    price: Number(bet.endPrice),
    color: bet.result === "won" ? "#35d59a" : "#ff6877",
    lineWidth: 1 as const,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Resolved",
  };
}

export function PriceChart({ prices, bet, staticHistory = false }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const resolutionPriceLineRef = useRef<IPriceLine | null>(null);
  const timestampsRef = useRef(new Map<number, string>());

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
      if (entry)
        chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      resolutionPriceLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const chartData = toChartData(prices);

    timestampsRef.current = new Map(
      chartData.map((point) => [point.time, point.eventTimestamp]),
    );

    series.setData(
      chartData.map(({ time, value }) => ({
        time,
        value,
      })),
    );

    markersRef.current?.setMarkers(
      bet
        ? [{
            time: Math.floor(Date.parse(bet.startEventTimestamp) / 1_000) as UTCTimestamp,
            position: bet.direction === "up" ? "belowBar" : "aboveBar",
            color: bet.direction === "up" ? "#35d59a" : "#ff6877",
            shape: bet.direction === "up" ? "arrowUp" : "arrowDown",
            text: `${bet.direction.toUpperCase()} · $${Number(bet.startPrice).toLocaleString()}`,
          }, ...(bet.status === "resolved" ? [{
            time: Math.floor(Date.parse(bet.endEventTimestamp) / 1_000) as UTCTimestamp,
            position: bet.result === "won" ? "aboveBar" as const : "belowBar" as const,
            color: bet.result === "won" ? "#35d59a" : "#ff6877",
            shape: "circle" as const,
            text: `${bet.result.toUpperCase()} · $${Number(bet.endPrice).toLocaleString()}`,
          }] : [])]
        : [],
    );

    if (resolutionPriceLineRef.current) {
      series.removePriceLine(resolutionPriceLineRef.current);
      resolutionPriceLineRef.current = null;
    }

    const resolutionLine = resolutionPriceLineOptions(bet, staticHistory);
    if (resolutionLine) {
      resolutionPriceLineRef.current = series.createPriceLine(resolutionLine);
    }

    series.applyOptions({
      lineColor: bet
        ? bet.direction === "up" ? "#35d59a" : "#ff6877"
        : "#f7a52b",
      priceLineColor: bet
        ? bet.direction === "up" ? "#35d59a" : "#ff6877"
        : "#f7931a",
      priceLineVisible: !resolutionLine,
      lastValueVisible: !resolutionLine,
    });

    chart.timeScale().fitContent();
  }, [bet, prices, staticHistory]);

  const headlinePrice = chartHeadlinePrice(prices, bet, staticHistory);

  return (
    <section
      className={`price-chart${bet ? ` price-chart--active price-chart--${bet.direction}` : ""}`}
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
      </div>
    </section>
  );
}
