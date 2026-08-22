import { ActiveBetChart } from "@/components/MarketView/ActiveBetChart";
import { DefaultBetChart } from "@/components/MarketView/DefaultBetChart";
import { useGameSession } from "@/context/useGameSession";
import { panelStyle } from "@/styles/ui";

export function MarketView() {
  const session = useGameSession();

  const { activeBet } = session;

  return activeBet ? <ActiveBetChart bet={activeBet} /> : <DefaultBetChart />;
}
