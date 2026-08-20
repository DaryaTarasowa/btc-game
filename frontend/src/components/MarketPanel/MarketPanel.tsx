import { useGameSession } from "@/context/useGameSession";
import { PriceChart } from "@/components/PriceChart/PriceChart";

const marketStateStyle =
  "grid min-h-[490px] place-content-center justify-items-center gap-2 rounded-3xl border border-white/10 bg-[#141927]/85 p-8 text-center text-[#8490a9] max-[820px]:min-h-80";

export function MarketPanel() {
  const session = useGameSession();
  const {
    activeBet,
    pricesError: error,
    pricesPending: isPending,
    prices,
    productName,
  } = session;
  return (
    <div className="min-w-0" aria-live="polite">
      {isPending ? (
        <div className={marketStateStyle}>
          <span
            className="mb-1.5 size-[11px] rounded-full bg-bitcoin shadow-[0_0_0_0_rgba(247,147,26,0.5)] motion-safe:animate-[market-pulse_1.5s_infinite]"
            aria-hidden="true"
          />
          <strong className="text-slate-200">
            Loading {productName} market history
          </strong>
          <span>Reading the latest stored trades…</span>
        </div>
      ) : error ? (
        <div className={`${marketStateStyle} text-[#ff9b9b]`}>
          <strong>Market data unavailable</strong>
          <span>{error.message}</span>
        </div>
      ) : prices.length === 0 ? (
        <div className={marketStateStyle}>
          <strong className="text-slate-200">
            No recent {productName} prices
          </strong>
          <span>
            The market feed has not stored any trades in the last 3 minutes.
          </span>
        </div>
      ) : (
        <PriceChart prices={prices} bet={activeBet} />
      )}
    </div>
  );
}
