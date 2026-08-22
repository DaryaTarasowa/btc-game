import { useQuery } from "@tanstack/react-query";
import { getPlayer } from "@/api/players";

export function usePlayerScore(playerId: string | null) {
  return useQuery({
    queryKey: ["player", playerId],
    queryFn: ({ signal }) => getPlayer(signal),
    enabled: Boolean(playerId),
  });
}
