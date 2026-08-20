export function betStatusQuery(playerId, betId) {
  if (typeof betId !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(betId)) return null;
  return {
    KeyConditionExpression: "playerId = :playerId",
    FilterExpression: "#id = :betId",
    ExpressionAttributeNames: { "#id": "id" },
    ExpressionAttributeValues: { ":playerId": playerId, ":betId": betId },
    ConsistentRead: true,
  };
}
