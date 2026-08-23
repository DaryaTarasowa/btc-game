import { useQuery } from "@tanstack/react-query";
import { getPlayer } from "@/api/players";
import { queryKeys } from "./queryKeys";

export function usePlayerScore(playerId: string | null) {
  return useQuery({
    queryKey: playerId ? queryKeys.player(playerId) : queryKeys.disabled,
    queryFn: ({ signal }) => getPlayer(signal),
    enabled: Boolean(playerId),
  });
}
