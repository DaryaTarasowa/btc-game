import { createContext, useCallback, useMemo, type PropsWithChildren } from "react";
import type { ActiveBet, ResolvedBet } from "@/api/bets";
import type { MarketPrice } from "@/api/prices";
import { marketProductDisplayName } from "@/config/market";
import { useMarket } from "@/context/useMarket";
import { usePlayer } from "@/context/usePlayer";
import { BetDirection } from "@/domain/bets";
import { useBetSynchronization } from "@/queries/useBetSynchronization";
import { useCreateBet } from "@/queries/useCreateBet";
import { useLivePrices, useRecentPrices } from "@/queries/useRecentPrices";

export interface GameSessionContextValue {
  activeBet: ActiveBet | null;
  resolvedBet: ResolvedBet | null;
  prices: MarketPrice[];
  latestVisiblePoint?: MarketPrice;
  productName: string;
  pricesError: Error | null;
  pricesPending: boolean;
  creationError: string | undefined;
  isCreating: boolean;
  isRecovering: boolean;
  chooseDirection: (direction: BetDirection) => void;
}

export const GameSessionContext = createContext<GameSessionContextValue | null>(null);

export function GameSessionProvider({ children }: PropsWithChildren) {
  const { playerId, player } = usePlayer();
  const { product } = useMarket();
  const recentPrices = useRecentPrices();
  useLivePrices();

  const prices = recentPrices.data ?? [];
  const latestVisiblePoint = prices.at(-1);
  const { activeBet, resolvedBet, isRecovering, trackCreatedBet } =
    useBetSynchronization(playerId, player?.activeBetId);
  const createBet = useCreateBet(trackCreatedBet);

  const chooseDirection = useCallback((direction: BetDirection) => {
    if (!latestVisiblePoint) return;
    createBet.mutate({ direction, point: latestVisiblePoint });
  }, [createBet, latestVisiblePoint]);

  const value = useMemo<GameSessionContextValue>(() => ({
    activeBet,
    resolvedBet,
    prices,
    latestVisiblePoint,
    productName: marketProductDisplayName(product),
    pricesError: recentPrices.error,
    pricesPending: recentPrices.isPending,
    creationError: createBet.error?.message,
    isCreating: createBet.isPending,
    isRecovering,
    chooseDirection,
  }), [
    activeBet,
    chooseDirection,
    createBet.error,
    createBet.isPending,
    isRecovering,
    latestVisiblePoint,
    prices,
    product,
    recentPrices.error,
    recentPrices.isPending,
    resolvedBet,
  ]);

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
}
