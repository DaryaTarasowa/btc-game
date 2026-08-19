import { useMutation } from "@tanstack/react-query";
import { createPlayer } from "../api/players";
import { usePlayer } from "../context/usePlayer";

export function useCreatePlayer() {
  const { setPlayerId } = usePlayer();
  return useMutation({ mutationFn: createPlayer, onSuccess: setPlayerId });
}
