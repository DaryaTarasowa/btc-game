import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BetCreationError, createBet } from "./bets.mjs";
import { betStatusQuery, resolvedBetsQuery } from "./status.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const priceHistoryTable = process.env.PRICE_HISTORY_TABLE;
const betsTable = process.env.BETS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const playerId = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof playerId !== "string") return json(401, { error: "unauthorized", message: "Authentication is required." });
  if (event?.requestContext?.http?.method === "GET") {
    const betId = event?.pathParameters?.betId;
    if (betId === undefined) {
      const bets = [];
      let cursor;
      do {
        const result = await dynamodb.send(new QueryCommand({
          TableName: betsTable,
          ...resolvedBetsQuery(playerId),
          ExclusiveStartKey: cursor,
        }));
        bets.push(...(result.Items ?? []));
        cursor = result.LastEvaluatedKey;
      } while (cursor);
      return json(200, { bets });
    }
    const query = betStatusQuery(playerId, betId);
    if (!query) return json(400, { error: "invalid_bet_id" });
    let cursor;
    do {
      const result = await dynamodb.send(new QueryCommand({ TableName: betsTable, ...query, ExclusiveStartKey: cursor }));
      if (result.Items?.[0]) return json(200, result.Items[0]);
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return json(404, { error: "bet_not_found" });
  }
  let request;
  try {
    request = { ...JSON.parse(event?.body ?? ""), playerId };
  } catch {
    return json(400, { error: "invalid_json", message: "Request body must be valid JSON." });
  }

  try {
    const bet = await createBet(request, {
      createId: randomUUID,
      now: () => new Date(),
      async getHistoryPoint(product, sourceTimestamp) {
        const result = await dynamodb.send(new GetCommand({
          TableName: priceHistoryTable,
          Key: { product, sourceTimestamp },
          ProjectionExpression: "#price",
          ExpressionAttributeNames: { "#price": "price" },
          ConsistentRead: true,
        }));
        return result.Item;
      },
      async putActiveBet(betToStore) {
        await dynamodb.send(new PutCommand({
          TableName: betsTable,
          Item: betToStore,
          ConditionExpression: "attribute_not_exists(playerId)",
        }));
      },
      isDuplicateError: (error) => error?.name === "ConditionalCheckFailedException",
    });
    return json(201, bet);
  } catch (error) {
    if (error instanceof BetCreationError) {
      return json(error.statusCode, { error: error.code, message: error.message });
    }
    console.error("bet_creation_failed", error);
    return json(500, { error: "internal_error", message: "Bet creation failed." });
  }
};
