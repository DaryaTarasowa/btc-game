export const queryKeys = {
  player: (playerId: string) => ["player", playerId] as const,

  bets: (playerId: string) => ["bets", playerId] as const,

  betHistory: (playerId: string) => ["bets", playerId, "history"] as const,

  bet: (playerId: string, betId: string) =>
    ["bets", "id", playerId, betId] as const,

  recentPrices: (product: string) => ["prices", product, "recent"] as const,

  resolvedBetPrices: (betId: string) => ["prices", "bet", betId] as const,

  disabled: ["disabled"] as const,
};
