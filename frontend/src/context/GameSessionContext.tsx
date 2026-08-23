import { useCallback, useMemo, type PropsWithChildren } from "react";
import { marketProductDisplayName } from "@/config/market";
import { useMarket } from "@/context/useMarket";
import { usePlayer } from "@/context/usePlayer";
import { BetDirection } from "@/domain/bets";
import { useBetSynchronization } from "@/hooks/useBetSynchronization";
import { useCreateBet } from "@/hooks/useCreateBet";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useRecentPrices } from "@/hooks/useRecentPrices";
import { createContext } from "react";
import type { ActiveBet, ResolvedBet } from "@/api/bets";
import type { MarketPrice } from "@/api/prices";

export interface GameSessionValue {
  activeBet: ActiveBet | null;
  resolvedBet: ResolvedBet | null;
  prices: MarketPrice[];
  latestVisiblePoint?: MarketPrice;
  productName: string;
  pricesError: Error | null;
  isPricesPending: boolean;
  betCreationError: string | undefined;
  isBetCreating: boolean;
  isBetRecovering: boolean;
  chooseDirection: (direction: BetDirection) => void;
}

export const GameSessionContext = createContext<GameSessionValue | null>(null);

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

  const chooseDirection = useCallback(
    (direction: BetDirection) => {
      if (!latestVisiblePoint) return;
      createBet.mutate({ direction, point: latestVisiblePoint });
    },
    [createBet, latestVisiblePoint],
  );

  const value = useMemo<GameSessionValue>(
    () => ({
      activeBet,
      resolvedBet,
      prices,
      latestVisiblePoint,
      productName: marketProductDisplayName(product),
      pricesError: recentPrices.error,
      isPricesPending: recentPrices.isPending,
      betCreationError: createBet.error?.message,
      isBetCreating: createBet.isPending,
      isBetRecovering: isRecovering,
      chooseDirection,
    }),
    [
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
    ],
  );

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
}
