import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { BetCreationError, createBet } from "./bets.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const priceHistoryTable = process.env.PRICE_HISTORY_TABLE;
const betsTable = process.env.BETS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  let request;
  try {
    request = JSON.parse(event?.body ?? "");
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
