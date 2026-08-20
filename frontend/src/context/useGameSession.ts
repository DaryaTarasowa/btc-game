import { useContext } from "react";
import { GameSessionContext } from "@/context/GameSessionContext";

export function useGameSession() {
  const session = useContext(GameSessionContext);
  if (!session) {
    throw new Error("useGameSession must be used inside GameSessionProvider.");
  }
  return session;
}
