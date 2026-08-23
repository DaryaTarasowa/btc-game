import { useGameSession } from "@/context/useGameSession";
import {
  PriceChart,
  PriceChartProps,
} from "@/components/PriceChart/PriceChart";
import type { ActiveBet } from "@/api/bets";
import { BetDirection } from "@/domain/bets";
import { getThemeColor } from "@/utils";
import { useBetCountdown } from "@/hooks/useBetCountdown";

type ActiveBetChartConfig = Pick<
  PriceChartProps,
  | "colors"
  | "referenceLines"
  | "guides"
  | "visibleRange"
  | "annotation"
  | "subtitle"
>;

function activeBetChartConfig(bet: ActiveBet): ActiveBetChartConfig {
  const color =
    bet.direction === BetDirection.Up
      ? getThemeColor("--color-up")
      : getThemeColor("--color-down");

  const secondsRemaining = useBetCountdown(bet?.resolutionTargetTimestamp);

  return {
    colors: {
      accent: color,
      graph: color,
      surface: color,
      background: getThemeColor("--color-ink"),
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

    annotation: {
      text: (
        <span>
          {bet.direction.toUpperCase()} position active
          <span className="hidden max-[820px]:inline">
            {" · "}
            <span className="text-base font-bold">{secondsRemaining}</span>sec
            remain
          </span>
        </span>
      ),
      color,
    },
  };
}

export function ActiveBetChart({ bet }: { bet: ActiveBet }) {
  const session = useGameSession();

  const {
    pricesError: error,
    isPricesPending: isPending,
    prices,
    productName,
  } = session;

  const chartConfig = activeBetChartConfig(bet);

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
        subtitle={chartConfig?.subtitle}
        messages={{
          loading: (
            <>
              <span
                className="mb-1.5 size-[11px] rounded-full bg-accent animate-[market-pulse_1.5s_infinite]"
                aria-hidden="true"
              />
              <strong className="text-muted">
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
