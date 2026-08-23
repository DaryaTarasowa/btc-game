import { ActiveBetChart } from "@/views/MarketView/ActiveBetChart";
import { DefaultBetChart } from "@/views/MarketView/DefaultBetChart";
import { useGameSession } from "@/context/useGameSession";

export function MarketView() {
  const session = useGameSession();

  const { activeBet } = session;

  return activeBet ? <ActiveBetChart bet={activeBet} /> : <DefaultBetChart />;
}
