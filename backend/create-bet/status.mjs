export function betStatusKey(playerId, betId) {
  if (typeof betId !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(betId)) return null;
  return { playerId, betId };
}

export function resolvedBetsQuery(playerId) {
  return {
    KeyConditionExpression: "playerId = :playerId",
    FilterExpression: "#status = :resolved",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":playerId": playerId,
      ":resolved": BetStatus.Resolved,
    },
    ConsistentRead: true,
  };
}

export function sortResolvedBets(bets) {
  return [...bets].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
import { BetStatus } from "./domain.mjs";
