import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.PLAYERS_TABLE;

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event?.requestContext?.http?.method === "GET") {
    const playerId = event.pathParameters?.playerId;
    if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
      return response(400, { error: "invalid_player_id" });
    }

    const result = await dynamodb.send(new GetCommand({
      TableName: tableName,
      Key: { playerId },
      ConsistentRead: true,
    }));
    return result.Item
      ? response(200, result.Item)
      : response(404, { error: "player_not_found" });
  }

  const player = {
    playerId: randomUUID(),
    score: 0,
    createdAt: new Date().toISOString(),
  };

  await dynamodb.send(
    new PutCommand({
      TableName: tableName,
      Item: player,
      ConditionExpression: "attribute_not_exists(playerId)",
    }),
  );

  return response(201, player);
};
