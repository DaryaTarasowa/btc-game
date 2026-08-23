import { useGameSession } from "@/context/useGameSession";
import {
  PriceChart,
  PriceChartProps,
} from "@/components/PriceChart/PriceChart";
import { getThemeColor } from "@/utils";

type DefaultBetChart = Pick<
  PriceChartProps,
  | "colors"
  | "referenceLines"
  | "guides"
  | "visibleRange"
  | "annotation"
  | "tone"
>;

function defaultBetChartConfig(): DefaultBetChart {
  return {
    colors: {
      accent: getThemeColor("--color-accent"),
      graph: getThemeColor("--color-bitcoin"),
      surface: getThemeColor("--color-ink"),
      background: getThemeColor("--color-ink"),
      border: getThemeColor("--color-muted"),
      text: getThemeColor("--color-white"),
      mutedText: getThemeColor("--color-muted"),
    },
  };
}

export function DefaultBetChart() {
  const session = useGameSession();

  const {
    pricesError: error,
    isPricesPending: isPending,
    prices,
    productName,
    livePricesError,
    reconnectLivePrices,
  } = session;

  return (
    <div className="min-w-0" aria-live="polite">
      <PriceChart
        prices={prices}
        isPending={isPending}
        error={error}
        colors={defaultBetChartConfig().colors}
        headlineLabel={
          livePricesError ? (
            <button
              type="button"
              onClick={reconnectLivePrices}
              className="cursor-pointer text-sm text-danger transition hover:text-white"
              title="Reconnect live prices"
              aria-label="Reconnect live prices"
            >
              ↻ Reconnect
            </button>
          ) : undefined
        }
        subtitle="Stored market history · 3 min"
        messages={{
          loading: (
            <>
              <span
                className="mb-1.5 size-[11px] rounded-full bg-accent animate-[market-pulse_1.5s_infinite]"
                aria-hidden="true"
              />
              <strong className="text-muted">
                Loading {productName} market prices
              </strong>
              <span>Reading the latest trades…</span>
            </>
          ),
          error: (
            <>
              <strong>Market data unavailable</strong>
              <span>{error?.message}</span>
            </>
          ),
          empty: (
            <>
              <strong className="text-muted">
                No recent {productName} prices
              </strong>
              <span>
                The market feed has not stored any trades in the last 3 minutes.
              </span>
            </>
          ),
        }}
      />
    </div>
  );
}
