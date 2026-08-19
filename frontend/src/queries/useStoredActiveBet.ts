import { useCallback, useEffect, useState } from "react";
import { activeBetSchema, type ActiveBet } from "../api/bets";

const ACTIVE_BET_KEY_PREFIX = "btc-game.activeBet.v1";

function storageKey(playerId: string) {
  return `${ACTIVE_BET_KEY_PREFIX}.${playerId}`;
}

export function readStoredActiveBet(playerId: string | null): ActiveBet | null {
  if (!playerId) return null;
  const raw = localStorage.getItem(storageKey(playerId));
  if (!raw) return null;

  try {
    const parsed = activeBetSchema.parse(JSON.parse(raw));
    return parsed.playerId === playerId ? parsed : null;
  } catch {
    localStorage.removeItem(storageKey(playerId));
    return null;
  }
}

export function storeActiveBet(bet: ActiveBet) {
  localStorage.setItem(storageKey(bet.playerId), JSON.stringify(bet));
}

export function useStoredActiveBet(playerId: string | null) {
  const [activeBet, setActiveBetState] = useState<ActiveBet | null>(() =>
    readStoredActiveBet(playerId),
  );

  useEffect(() => {
    setActiveBetState(readStoredActiveBet(playerId));
  }, [playerId]);

  const setActiveBet = useCallback((bet: ActiveBet) => {
    storeActiveBet(bet);
    setActiveBetState(bet);
  }, []);

  return [activeBet, setActiveBet] as const;
}
