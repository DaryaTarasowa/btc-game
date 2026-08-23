import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { MarketPrice } from "@/api/prices";
import { marketProductDisplayName } from "@/config/market";
import {
  createPriceChartTheme,
  type PriceChartColors,
  type PriceChartTheme,
} from "@/components/PriceChart/PriceChart.style";
import {
  toChartData,
  priceFormatter,
  timeFormatter,
  toUnixTimestamp,
  toPriceLineOptions,
  positionGuide,
  extendSeriesToRangeEnd,
  replaceReferencePriceLines,
  type PriceChartReferenceLine,
  type PriceChartGuide,
  type PriceChartRange,
  type PriceChartAnnotation,
  type PriceChartTone,
} from "@/components/PriceChart/priceChartUtils";

const chartStateStyle =
  "grid place-content-center justify-items-center gap-2 rounded-3xl border p-8 text-center";

const defaultStateSize = "min-h-[490px] max-[820px]:min-h-80";

const chartFrameStyle =
  "min-w-0 overflow-hidden rounded-3xl border transition-[border-color,box-shadow,background] duration-200";

const chartHeaderStyle =
  "flex items-start justify-between gap-6 px-7 pt-6 pb-2 max-[560px]:px-4.5 max-[560px]:pt-5 max-[560px]:pb-1.5";

const tooltipStyle =
  "pointer-events-none absolute z-[2] min-w-[130px] rounded-[10px] border px-3 py-2.5 [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_strong]:block [&_strong]:text-sm [&_strong]:[font-variant-numeric:tabular-nums]";

const verticalGuideStyle =
  "pointer-events-none absolute inset-y-0 z-[2] w-0 border-l border-dotted border-current opacity-50";

const guideDotStyle =
  "pointer-events-none absolute z-[3] size-[11px] -translate-1/2 rounded-full border-2 bg-current shadow-[0_0_0_2px_currentColor]";

export interface PriceChartProps {
  prices?: MarketPrice[];

  headlinePrice?: string;
  headlineLabel?: ReactNode;
  subtitle?: ReactNode;
  annotation?: PriceChartAnnotation;
  tone?: PriceChartTone;

  visibleRange?: PriceChartRange;
  referenceLines?: PriceChartReferenceLine[];
  guides?: PriceChartGuide[];
  priorityTimestamps?: string[];

  colors?: Partial<PriceChartColors>;

  isPending?: boolean;
  error?: Error | null;
  messages?: Partial<PriceChartStateMessages>;
  stateClassName?: string;
}

type ChartRendererProps = Omit<
  PriceChartProps,
  "isPending" | "error" | "messages" | "stateClassName" | "colors"
> & {
  prices: MarketPrice[];
  theme: PriceChartTheme;
};

interface PriceChartStateMessages {
  loading: ReactNode;
  empty: ReactNode;
  error: ReactNode;
}

export function PriceChart(props: PriceChartProps) {
  const {
    prices = [],
    colors,
    isPending = false,
    error = null,
    messages,
    stateClassName = defaultStateSize,
  } = props;
  const theme = useMemo(
    () => createPriceChartTheme(colors),
    [
      colors?.accent,
      colors?.graph,
      colors?.background,
      colors?.surface,
      colors?.border,
      colors?.text,
      colors?.mutedText,
    ],
  );

  if (isPending) {
    return (
      <PriceChartState className={stateClassName} role="status" theme={theme}>
        {messages?.loading ?? "Loading market prices…"}
      </PriceChartState>
    );
  }

  if (error) {
    return (
      <PriceChartState className={stateClassName} role="alert" theme={theme}>
        <span style={{ color: "red" }}>{messages?.error ?? error.message}</span>
      </PriceChartState>
    );
  }

  if (prices.length === 0) {
    return (
      <PriceChartState className={stateClassName} role="status" theme={theme}>
        {messages?.empty ?? "No market prices are available."}
      </PriceChartState>
    );
  }

  return (
    <ChartRenderer
      prices={prices}
      headlinePrice={props.headlinePrice}
      headlineLabel={props.headlineLabel}
      subtitle={props.subtitle}
      annotation={props.annotation}
      tone={props.tone}
      visibleRange={props.visibleRange}
      referenceLines={props.referenceLines}
      guides={props.guides}
      priorityTimestamps={props.priorityTimestamps}
      theme={theme}
    />
  );
}

function PriceChartState({
  className,
  role,
  children,
  theme,
}: {
  className: string;
  role: "status" | "alert";
  children: ReactNode;
  theme: PriceChartTheme;
}) {
  return (
    <div
      className={`${chartStateStyle} ${className}`}
      role={role}
      style={{
        background: theme.state.background,
        borderColor: theme.state.border,
        color: theme.colors.mutedText,
      }}
    >
      {children}
    </div>
  );
}

function createPriceChartInstance(
  container: HTMLDivElement,
  theme: PriceChartTheme,
) {
  const chart = createChart(container, {
    width: container.clientWidth,
    height: 390,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: theme.colors.mutedText,
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: theme.crosshair,
        labelBackgroundColor: theme.colors.accent,
      },
      horzLine: {
        color: theme.crosshair,
        labelBackgroundColor: theme.colors.accent,
      },
    },
    rightPriceScale: {
      borderColor: theme.axisBorder,
      scaleMargins: { top: 0.12, bottom: 0.12 },
      autoScale: true,
    },
    timeScale: {
      borderColor: theme.axisBorder,
      timeVisible: true,
      secondsVisible: true,
      rightOffset: 2,
    },
    localization: {
      priceFormatter: (price: number) => priceFormatter.format(price),
    },
    handleScroll: false,
    handleScale: { axisPressedMouseMove: false },
  });

  const series = chart.addSeries(AreaSeries, {
    lineColor: theme.colors.graph,
    topColor: theme.fill.top,
    bottomColor: theme.fill.bottom,
    lineWidth: 2,
    crosshairMarkerBackgroundColor: theme.colors.accent,
    crosshairMarkerBorderColor: theme.colors.text,
    priceLineColor: theme.colors.accent,
    priceLineWidth: 1,
    lastValueVisible: true,
    priceLineVisible: true,
  });

  return { chart, series };
}

function ChartRenderer({
  prices = [],
  headlinePrice,
  headlineLabel = "Latest price",
  subtitle,
  annotation,
  visibleRange,
  referenceLines = [],
  guides = [],
  priorityTimestamps = [],
  theme,
}: ChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const referencePriceLinesRef = useRef<IPriceLine[]>([]);
  const timestampsRef = useRef(new Map<number, string>());

  const firstGuideRef = useRef<HTMLDivElement>(null);
  const secondGuideRef = useRef<HTMLDivElement>(null);
  const firstDotRef = useRef<HTMLDivElement>(null);
  const secondDotRef = useRef<HTMLDivElement>(null);

  const guidesRef = useRef(guides);
  guidesRef.current = guides;

  const positionGuides = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const [firstGuide, secondGuide] = guidesRef.current;

    if (!chart || !series) return;

    positionGuide(chart, series, firstGuide, firstGuideRef, firstDotRef);
    positionGuide(chart, series, secondGuide, secondGuideRef, secondDotRef);
  }, []);

  // Creates and owns the Lightweight Charts instance.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { chart, series } = createPriceChartInstance(container, theme);

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

      tooltip.innerHTML =
        `<strong>${priceFormatter.format(data.value)}</strong>` +
        `<span>${timeFormatter.format(
          new Date(timestamp ?? unixTime * 1_000),
        )}</span>`;

      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(
        Math.max(parameter.point.x + 14, 8),
        container.clientWidth - tooltip.offsetWidth - 8,
      )}px`;
      tooltip.style.top = `${Math.max(
        parameter.point.y - tooltip.offsetHeight - 14,
        8,
      )}px`;
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
      });

      requestAnimationFrame(positionGuides);
    });

    resizeObserver.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(positionGuides);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(positionGuides);
      resizeObserver.disconnect();
      chart.remove();

      chartRef.current = null;
      seriesRef.current = null;
      referencePriceLinesRef.current = [];
    };
  }, [positionGuides, theme]);

  // Synchronizes chart data, reference lines, colors, and visible range with the latest props.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!chart || !series) return;

    const chartData = toChartData(prices, priorityTimestamps);

    timestampsRef.current = new Map(
      chartData.map((point) => [point.time, point.eventTimestamp]),
    );

    const seriesData: Array<{
      time: UTCTimestamp;
      value?: number;
    }> = chartData.map(({ time, value }) => ({
      time,
      value,
    }));

    series.setData(extendSeriesToRangeEnd(seriesData, visibleRange));

    replaceReferencePriceLines(
      series,
      referencePriceLinesRef,
      toPriceLineOptions(referenceLines),
    );

    const hasReferenceLines = referenceLines.length > 0;

    series.applyOptions({
      lineColor: theme.colors.graph,
      priceLineColor: theme.colors.accent,
      priceLineVisible: !hasReferenceLines,
      lastValueVisible: !hasReferenceLines,
      topColor: theme.fill.top,
      bottomColor: theme.fill.bottom,
      crosshairMarkerBackgroundColor: theme.colors.accent,
    });

    if (visibleRange) {
      chart.timeScale().setVisibleRange({
        from: toUnixTimestamp(visibleRange.from),
        to: toUnixTimestamp(visibleRange.to),
      });
    } else {
      chart.timeScale().fitContent();
    }

    const frame = requestAnimationFrame(positionGuides);
    return () => cancelAnimationFrame(frame);
  }, [
    priorityTimestamps,
    positionGuides,
    prices,
    referenceLines,
    theme,
    visibleRange,
  ]);

  const product = prices[0]?.product; //TODO have this in settings somewhere - all prices have to have the same product
  const displayedPrice = headlinePrice ?? prices.at(-1)?.price;

  return (
    <section
      className={chartFrameStyle}
      style={theme.frame}
      aria-label={`${product ? marketProductDisplayName(product) : "Market"} price chart`}
    >
      <ChartHeader
        product={product}
        headlinePrice={displayedPrice}
        headlineLabel={headlineLabel}
        subtitle={subtitle}
        annotation={annotation}
        theme={theme}
      />

      <div className="relative min-h-[390px] w-full" ref={containerRef}>
        <div
          className={tooltipStyle}
          ref={tooltipRef}
          hidden
          style={{
            background: theme.tooltip.background,
            borderColor: theme.tooltip.border,
            boxShadow: theme.tooltip.shadow,
            color: theme.colors.text,
          }}
        />

        <ChartGuides
          guides={guides}
          theme={theme}
          refs={{
            firstGuide: firstGuideRef,
            secondGuide: secondGuideRef,
            firstDot: firstDotRef,
            secondDot: secondDotRef,
          }}
        />
      </div>
    </section>
  );
}

interface ChartHeaderProps {
  product?: string;
  headlinePrice?: string;
  headlineLabel: ReactNode;
  subtitle: ReactNode;
  annotation?: PriceChartAnnotation;
  theme: PriceChartTheme;
}

function ChartHeader({
  product,
  headlinePrice,
  headlineLabel,
  subtitle,
  annotation,
  theme,
}: ChartHeaderProps) {
  return (
    <header className={chartHeaderStyle}>
      <div>
        <p
          className="m-0 text-base font-extrabold tracking-[0.04em]"
          style={{ color: theme.colors.text }}
        >
          <span style={{ color: theme.colors.graph }} aria-hidden="true">
            ₿
          </span>{" "}
          {product ? marketProductDisplayName(product) : "—"}
        </p>

        <p
          className="mt-1.5 mb-0 text-xs"
          style={{ color: theme.colors.mutedText }}
        >
          {subtitle}
        </p>

        {annotation && (
          <p
            className="mt-2 mb-0 text-xs font-extrabold tracking-[0.08em] uppercase"
            style={{ color: annotation.color }}
          >
            <span
              className="mr-1 inline-block size-[7px] rounded-full bg-current animate-[bet-pulse_1.6s_infinite]"
              aria-hidden="true"
            />{" "}
            {annotation.text}
          </p>
        )}
      </div>

      <div className="text-right">
        <span
          className="block text-xs tracking-[0.1em] uppercase"
          style={{ color: theme.colors.mutedText }}
        >
          {headlineLabel}
        </span>

        <strong
          className="mt-1 block text-[clamp(1.35rem,3vw,2rem)] [font-variant-numeric:tabular-nums] max-[560px]:text-xl"
          style={{ color: theme.colors.text }}
        >
          {headlinePrice ? priceFormatter.format(Number(headlinePrice)) : "—"}
        </strong>
      </div>
    </header>
  );
}

interface GuideRefs {
  firstGuide: RefObject<HTMLDivElement | null>;
  secondGuide: RefObject<HTMLDivElement | null>;
  firstDot: RefObject<HTMLDivElement | null>;
  secondDot: RefObject<HTMLDivElement | null>;
}

interface ChartGuidesProps {
  guides: PriceChartGuide[];
  theme: PriceChartTheme;
  refs: GuideRefs;
}

function ChartGuides({ guides, theme, refs }: ChartGuidesProps) {
  const [firstGuide, secondGuide] = guides;

  if (!firstGuide && !secondGuide) return null;

  return (
    <>
      {firstGuide && (
        <Guide
          guide={firstGuide}
          guideRef={refs.firstGuide}
          dotRef={refs.firstDot}
          theme={theme}
        />
      )}

      {secondGuide && (
        <Guide
          guide={secondGuide}
          guideRef={refs.secondGuide}
          dotRef={refs.secondDot}
          theme={theme}
        />
      )}
    </>
  );
}

interface GuideProps {
  guide: PriceChartGuide;
  guideRef: RefObject<HTMLDivElement | null>;
  dotRef: RefObject<HTMLDivElement | null>;
  theme: PriceChartTheme;
}

function Guide({ guide, guideRef, dotRef, theme }: GuideProps) {
  return (
    <>
      <div
        className={verticalGuideStyle}
        ref={guideRef}
        style={{ color: guide.color }}
        aria-hidden="true"
      />

      {guide.price && (
        <div
          className={guideDotStyle}
          ref={dotRef}
          style={{
            color: guide.color,
            borderColor: theme.guideDotBorder,
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
