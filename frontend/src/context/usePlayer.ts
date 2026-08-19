import { useContext } from "react";
import { PlayerContext } from "./PlayerContext";

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used within PlayerProvider.");
  return player;
}
