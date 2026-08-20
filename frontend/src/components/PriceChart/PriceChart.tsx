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
import { BetDirection, BetResult, BetStatus } from "@/domain/bets";
import { marketProductDisplayName } from "@/config/market";

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
  if (staticHistory && bet?.status === BetStatus.Resolved) return bet.endPrice;
  return prices.at(-1)?.price;
}

function resultColor(bet: ResolvedBet) {
  return bet.result === BetResult.Won ? "#35d59a" : "#ff6877";
}

export function betGraphColor(bet: ActiveBet | ResolvedBet) {
  return bet.direction === BetDirection.Up ? "#35d59a" : "#ff6877";
}

export function staticGraphFillColors(bet: ResolvedBet) {
  return bet.direction === BetDirection.Up
    ? { top: "rgba(53, 213, 154, 0.28)", bottom: "rgba(53, 213, 154, 0.015)" }
    : { top: "rgba(255, 104, 119, 0.28)", bottom: "rgba(255, 104, 119, 0.015)" };
}

export function referencePriceLineOptions(
  bet: ActiveBet | ResolvedBet | null | undefined,
  staticHistory: boolean,
) {
  if (!bet) return [];
  if (!staticHistory && bet.status === BetStatus.Active) {
    return [{ price: Number(bet.startPrice), color: betGraphColor(bet), lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Placed" }];
  }
  if (!staticHistory || bet.status !== BetStatus.Resolved) return [];
  const color = resultColor(bet);
  return [
    { price: Number(bet.startPrice), color, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Placed" },
    { price: Number(bet.endPrice), color, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Resolved" },
  ];
}

export function activeBetChartRange(bet: ActiveBet) {
  return {
    from: Math.floor((Date.parse(bet.startEventTimestamp) - 5_000) / 1_000) as UTCTimestamp,
    to: Math.floor(Date.parse(bet.resolutionTargetTimestamp) / 1_000) as UTCTimestamp,
  };
}

export function betGuideColors(bet: ActiveBet | ResolvedBet) {
  const annotationColor = bet.status === BetStatus.Resolved ? resultColor(bet) : betGraphColor(bet);
  return {
    creation: annotationColor,
    resolution: annotationColor,
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
  const creationDotRef = useRef<HTMLDivElement>(null);
  const resolutionDotRef = useRef<HTMLDivElement>(null);
  const betRef = useRef(bet);
  const staticHistoryRef = useRef(staticHistory);
  betRef.current = bet;
  staticHistoryRef.current = staticHistory;

  function positionHistoryGuides() {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const currentBet = betRef.current;
    if (!chart || !series || !currentBet) return;

    const creationX = chart.timeScale().timeToCoordinate(
      Math.floor(Date.parse(currentBet.startEventTimestamp) / 1_000) as UTCTimestamp,
    );
    const resolutionTimestamp = currentBet.status === BetStatus.Resolved
      ? currentBet.endEventTimestamp
      : currentBet.resolutionTargetTimestamp;
    const resolutionX = chart.timeScale().timeToCoordinate(
      Math.floor(Date.parse(resolutionTimestamp) / 1_000) as UTCTimestamp,
    );
    const creationY = series.priceToCoordinate(Number(currentBet.startPrice));
    const resolutionY = currentBet.status === BetStatus.Resolved
      ? series.priceToCoordinate(Number(currentBet.endPrice))
      : null;

    if (creationGuideRef.current && creationX !== null) creationGuideRef.current.style.left = `${creationX}px`;
    if (resolutionGuideRef.current && resolutionX !== null) resolutionGuideRef.current.style.left = `${resolutionX}px`;
    if (creationDotRef.current && creationX !== null && creationY !== null) {
      creationDotRef.current.style.left = `${creationX}px`;
      creationDotRef.current.style.top = `${creationY}px`;
    }
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
      handleScroll: false,
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

    const authoritativeTimestamps = staticHistory && bet?.status === BetStatus.Resolved
      ? [bet.startEventTimestamp, bet.endEventTimestamp]
      : [];
    const chartData = toChartData(prices, authoritativeTimestamps);

    timestampsRef.current = new Map(
      chartData.map((point) => [point.time, point.eventTimestamp]),
    );

    const seriesData = chartData.map(({ time, value }) => ({
        time,
        value,
      }));
    if (!staticHistory && bet?.status === BetStatus.Active) {
      const targetTime = activeBetChartRange(bet).to;
      const activeSeriesData = seriesData.some(({ time }) => time === targetTime)
        ? seriesData
        : [...seriesData, { time: targetTime }];
      activeSeriesData.sort((left, right) => Number(left.time) - Number(right.time));
      series.setData(activeSeriesData);
    } else {
      series.setData(seriesData);
    }

    const guideColors = bet ? betGuideColors(bet) : null;
    markersRef.current?.setMarkers(
      [],
    );

    for (const line of referencePriceLinesRef.current) series.removePriceLine(line);
    const referenceLines = referencePriceLineOptions(bet, staticHistory);
    referencePriceLinesRef.current = referenceLines.map((line) => series.createPriceLine(line));
    const staticFill = staticHistory && bet?.status === BetStatus.Resolved ? staticGraphFillColors(bet) : null;

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

    if (!staticHistory && bet?.status === BetStatus.Active) {
      chart.timeScale().setVisibleRange(activeBetChartRange(bet));
    } else {
      chart.timeScale().fitContent();
    }
    const animationFrame = requestAnimationFrame(positionHistoryGuides);
    return () => cancelAnimationFrame(animationFrame);
  }, [bet, prices, staticHistory]);

  const headlinePrice = chartHeadlinePrice(prices, bet, staticHistory);
  const guideColors = bet ? betGuideColors(bet) : null;
  const visualState = bet
    ? staticHistory && bet.status === BetStatus.Resolved ? bet.result : bet.direction
    : null;
  const stateClass = visualState === BetDirection.Up || visualState === BetResult.Won
    ? "border-up/50 bg-[linear-gradient(150deg,rgba(17,49,42,0.96),rgba(12,16,27,0.96)_58%)] shadow-[0_24px_80px_rgba(0,0,0,0.32),0_0_38px_rgba(53,213,154,0.12)]"
    : visualState === BetDirection.Down || visualState === BetResult.Lost
      ? "border-down/50 bg-[linear-gradient(150deg,rgba(55,25,35,0.96),rgba(12,16,27,0.96)_58%)] shadow-[0_24px_80px_rgba(0,0,0,0.32),0_0_38px_rgba(255,104,119,0.12)]"
      : "border-white/10 bg-[linear-gradient(150deg,rgba(22,28,43,0.96),rgba(12,16,27,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.32)]";
  const annotationTextClass = visualState === BetDirection.Up || visualState === BetResult.Won ? "text-up" : "text-down";
  const product = bet?.product ?? prices[0]?.product;

  return (
    <section
      className={`min-w-0 overflow-hidden rounded-3xl border transition-[border-color,box-shadow,background] duration-200 ${stateClass}`}
      aria-label={`${product ? marketProductDisplayName(product) : "Market"} price chart`}
    >
      <header className="flex items-start justify-between gap-6 px-7 pt-6 pb-2 max-[560px]:px-4.5 max-[560px]:pt-5 max-[560px]:pb-1.5">
        <div>
          <p className="m-0 text-base font-extrabold tracking-[0.04em] text-slate-50">
            <span className="text-bitcoin" aria-hidden="true">₿</span> {product ? marketProductDisplayName(product) : "—"}
          </p>
          <p className="mt-1.5 mb-0 text-xs text-[#77839e]">{staticHistory ? "Stored bet window" : "Stored market history · 3 min"}</p>
          {bet && (
            <p className={`mt-2 mb-0 text-xs font-extrabold tracking-[0.08em] uppercase ${annotationTextClass}`}>
              <span className="mr-1 inline-block size-[7px] rounded-full bg-current shadow-[0_0_0_0_currentColor] motion-safe:animate-[bet-pulse_1.6s_infinite]" aria-hidden="true" /> {bet.status === BetStatus.Resolved ? `${bet.result.toUpperCase()} ${bet.direction.toUpperCase()} prediction` : `${bet.direction.toUpperCase()} position active`}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="block text-xs tracking-[0.1em] text-[#77839e] uppercase">{staticHistory ? "Resolution price" : "Latest price"}</span>
          <strong className="mt-1 block text-[clamp(1.35rem,3vw,2rem)] text-white [font-variant-numeric:tabular-nums] max-[560px]:text-xl">
            {headlinePrice ? priceFormatter.format(Number(headlinePrice)) : "—"}
          </strong>
        </div>
      </header>
      <div className="relative min-h-[390px] w-full" ref={containerRef}>
        <div className="pointer-events-none absolute z-[2] min-w-[130px] rounded-[10px] border border-bitcoin/35 bg-[#080b12]/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_span]:text-slate-400 [&_strong]:block [&_strong]:text-sm [&_strong]:text-white [&_strong]:[font-variant-numeric:tabular-nums]" ref={tooltipRef} hidden />
        {bet && guideColors && (staticHistory ? bet.status === BetStatus.Resolved : bet.status === BetStatus.Active) && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 z-[2] w-0 border-l border-dotted border-current opacity-50"
              ref={creationGuideRef}
              style={{ color: guideColors.creation }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-y-0 z-[2] w-0 border-l border-dotted border-current opacity-50"
              ref={resolutionGuideRef}
              style={{ color: guideColors.resolution ?? undefined }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute z-[3] size-[11px] -translate-1/2 rounded-full border-2 border-[#101521] bg-current shadow-[0_0_0_2px_currentColor]"
              ref={creationDotRef}
              style={{ color: guideColors.creation }}
              aria-hidden="true"
            />
            {bet.status === BetStatus.Resolved && (
              <div
                className="pointer-events-none absolute z-[3] size-[11px] -translate-1/2 rounded-full border-2 border-[#101521] bg-current shadow-[0_0_0_2px_currentColor]"
                ref={resolutionDotRef}
                style={{ color: guideColors.resolution ?? undefined }}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
