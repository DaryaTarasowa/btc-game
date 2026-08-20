import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { BetCreationError, createBet, createBetTransaction } from "./bets.mjs";
import { betStatusKey, resolvedBetsQuery, sortResolvedBets } from "./status.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const priceHistoryTable = process.env.PRICE_HISTORY_TABLE;
const betsTable = process.env.BETS_TABLE;
const playersTable = process.env.PLAYERS_TABLE;

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
      return json(200, { bets: sortResolvedBets(bets) });
    }
    const key = betStatusKey(playerId, betId);
    if (!key) return json(400, { error: "invalid_bet_id" });
    const result = await dynamodb.send(new GetCommand({ TableName: betsTable, Key: key, ConsistentRead: true }));
    return result.Item ? json(200, result.Item) : json(404, { error: "bet_not_found" });
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
      async transactCreateBet(betToStore) {
        await dynamodb.send(new TransactWriteCommand(createBetTransaction(betToStore, betsTable, playersTable)));
      },
      isDuplicateError: (error) => error?.name === "TransactionCanceledException",
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
