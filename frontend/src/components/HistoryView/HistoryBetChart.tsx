import type { ResolvedBet } from "@/api/bets";
import { PriceChart } from "@/components/PriceChart/PriceChart";
import { useResolvedBetChart } from "@/queries/useResolvedBetChart";
import type { PriceChartProps } from "@/components/PriceChart/PriceChart";
import { BetDirection, BetResult } from "@/domain/bets";
import { getThemeColor } from "@/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner/LoadingSpinner";

type HistoryBetChartConfig = Pick<
  PriceChartProps,
  | "colors"
  | "headlinePrice"
  | "referenceLines"
  | "guides"
  | "visibleRange"
  | "annotation"
  | "tone"
  | "priorityTimestamps"
  | "headlineLabel"
  | "subtitle"
>;

export function historyBetChartConfig(bet: ResolvedBet): HistoryBetChartConfig {
  const directionColor =
    bet.direction === BetDirection.Up
      ? getThemeColor("--color-success")
      : getThemeColor("--color-error");

  const resultColor =
    bet.result === BetResult.Won
      ? getThemeColor("--color-success")
      : getThemeColor("--color-error");

  const annotation = `${bet.result} ${bet.direction} prediction`;

  return {
    colors: {
      accent: resultColor,
      graph: directionColor,
      surface: resultColor,
      border: resultColor,
      background: getThemeColor("--color-ink"),
    },

    headlinePrice: bet.endPrice,
    headlineLabel: "Resolution price",
    subtitle: "Stored bet window",
    referenceLines: [
      {
        price: bet.startPrice,
        label: "Placed",
        color: resultColor,
      },
      {
        price: bet.endPrice,
        label: "Resolved",
        color: resultColor,
      },
    ],

    guides: [
      {
        timestamp: bet.startEventTimestamp,
        price: bet.startPrice,
        color: resultColor,
      },
      {
        timestamp: bet.endEventTimestamp,
        price: bet.endPrice,
        color: resultColor,
      },
    ],
    priorityTimestamps: [bet.startEventTimestamp, bet.endEventTimestamp],
    annotation: {
      text: annotation,
      color: resultColor,
    },
  };
}

interface HistoryBetChartProps {
  bet: ResolvedBet;
}

export function HistoryBetChart({ bet }: HistoryBetChartProps) {
  const historicalPrices = useResolvedBetChart(bet);
  const chartConfig = historyBetChartConfig(bet);

  return (
    <div className="mb-4 text-left">
      <PriceChart
        prices={historicalPrices.data}
        colors={chartConfig.colors}
        headlinePrice={chartConfig.headlinePrice}
        headlineLabel={chartConfig.headlineLabel}
        subtitle={chartConfig.subtitle}
        referenceLines={chartConfig.referenceLines}
        guides={chartConfig.guides}
        isPending={historicalPrices.isPending}
        error={historicalPrices.error}
        annotation={chartConfig.annotation}
        stateClassName="min-h-55"
        messages={{
          loading: <LoadingSpinner color="var(--color-accent)" />,
          empty: "Stored market data is no longer available for this bet.",
        }}
      />
    </div>
  );
}
