import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.PLAYERS_TABLE;

export const handler = async () => {
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

  return {
    statusCode: 201,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(player),
  };
};
