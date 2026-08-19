import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { MarketPrice } from "../../api/prices";
import "./PriceChart.css";

interface PriceChartProps {
  prices: MarketPrice[];
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

export function PriceChart({ prices }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
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
        vertLine: { color: "rgba(247, 147, 26, 0.65)", labelBackgroundColor: "#f7931a" },
        horzLine: { color: "rgba(247, 147, 26, 0.4)", labelBackgroundColor: "#f7931a" },
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
      localization: { priceFormatter: (price: number) => priceFormatter.format(price) },
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
      if (entry) chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    timestampsRef.current = new Map(
      prices.map((point) => [Math.floor(Date.parse(point.eventTimestamp) / 1000), point.eventTimestamp]),
    );
    series.setData(
      prices.map((point) => ({
        time: Math.floor(Date.parse(point.eventTimestamp) / 1000) as UTCTimestamp,
        value: Number(point.price),
      })),
    );
    chart.timeScale().fitContent();
  }, [prices]);

  const latest = prices.at(-1);

  return (
    <section className="price-chart" aria-label="BTC to USD price chart">
      <header className="price-chart__header">
        <div>
          <p className="price-chart__symbol"><span aria-hidden="true">₿</span> BTC / USD</p>
          <p className="price-chart__window">Stored market history · 10 min</p>
        </div>
        <div className="price-chart__latest">
          <span>Latest price</span>
          <strong>{latest ? priceFormatter.format(Number(latest.price)) : "—"}</strong>
        </div>
      </header>
      <div className="price-chart__canvas" ref={containerRef}>
        <div className="price-chart__tooltip" ref={tooltipRef} hidden />
      </div>
    </section>
  );
}
