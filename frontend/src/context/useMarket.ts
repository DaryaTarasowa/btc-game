import { useContext } from "react";
import { MarketContext } from "@/context/MarketContext";

export function useMarket() {
  const market = useContext(MarketContext);
  if (!market) throw new Error("useMarket must be used inside MarketProvider.");
  return market;
}
