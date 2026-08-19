import { useMutation } from "@tanstack/react-query";
import { createBet } from "../api/bets";
import type { ActiveBet } from "../api/bets";

export function useCreateBet(onCreated: (bet: ActiveBet) => void) {
  return useMutation({
    mutationFn: createBet,
    onSuccess: (bet) => {
      onCreated(bet);
      console.info("Active bet created", bet);
    },
  });
}
