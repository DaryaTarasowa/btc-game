import { createContext, useMemo, useState, type ReactNode } from "react";
import { isPlayerId } from "../api/players";

const PLAYER_ID_KEY = "btc-game.playerId.v1";

export interface PlayerContextValue {
  playerId: string | null;
  setPlayerId: (playerId: string) => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

function readStoredPlayerId(): string | null {
  const playerId = localStorage.getItem(PLAYER_ID_KEY);
  return isPlayerId(playerId) ? playerId : null;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerIdState] = useState(readStoredPlayerId);
  const value = useMemo<PlayerContextValue>(
    () => ({
      playerId,
      setPlayerId(nextPlayerId) {
        localStorage.setItem(PLAYER_ID_KEY, nextPlayerId);
        setPlayerIdState(nextPlayerId);
      },
    }),
    [playerId],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
