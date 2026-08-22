import { useGameSession } from "@/context/useGameSession";
import {
  PriceChart,
  PriceChartProps,
} from "@/components/PriceChart/PriceChart";
import type { ActiveBet } from "@/api/bets";
import { BetDirection } from "@/domain/bets";
import { colors } from "@/styles/ui";

type ActiveBetChartConfig = Pick<
  PriceChartProps,
  | "colors"
  | "referenceLines"
  | "guides"
  | "visibleRange"
  | "annotation"
  | "tone"
>;

function activeBetChartConfig(bet: ActiveBet): ActiveBetChartConfig {
  const color =
    bet.direction === BetDirection.Up ? colors.success : colors.error;

  return {
    colors: {
      accent: color,
      graph: color,
      surface: color,
      background: colors.background,
      border: color,
    },
    referenceLines: [
      {
        price: bet.startPrice,
        label: "Placed",
        color,
      },
    ],
    guides: [
      {
        timestamp: bet.startEventTimestamp,
        price: bet.startPrice,
        color,
      },
      {
        timestamp: bet.resolutionTargetTimestamp,
        color,
      },
    ],
    visibleRange: {
      from: new Date(Date.parse(bet.startEventTimestamp) - 5_000).toISOString(),
      to: bet.resolutionTargetTimestamp,
    },
    tone: bet.direction === BetDirection.Up ? "positive" : "negative",

    annotation: {
      text: `${bet.direction.toUpperCase()} position active`,
      color,
    },
  };
}

export function ActiveBetChart() {
  const session = useGameSession();

  const {
    activeBet,
    pricesError: error,
    pricesPending: isPending,
    prices,
    productName,
  } = session;

  const chartConfig = activeBet ? activeBetChartConfig(activeBet) : undefined;

  return (
    <div className="min-w-0" aria-live="polite">
      <PriceChart
        prices={prices}
        isPending={isPending}
        error={error}
        colors={chartConfig?.colors}
        referenceLines={chartConfig?.referenceLines}
        guides={chartConfig?.guides}
        visibleRange={chartConfig?.visibleRange}
        annotation={chartConfig?.annotation}
        messages={{
          loading: (
            <>
              <span
                className="mb-1.5 size-[11px] rounded-full bg-accent animate-[market-pulse_1.5s_infinite]"
                aria-hidden="true"
              />
              <strong className="text-slate-200">
                Loading {productName} market history
              </strong>
              <span>Reading the latest stored trades…</span>
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
              <strong className="text-slate-200">
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
