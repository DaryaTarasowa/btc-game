import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { claimsFrom, validUsername } from "./players.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const playersTable = process.env.PLAYERS_TABLE;
const betsTable = process.env.BETS_TABLE;

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function deleteBets(playerId) {
  let cursor;
  do {
    const page = await dynamodb.send(new QueryCommand({
      TableName: betsTable,
      KeyConditionExpression: "playerId = :playerId",
      ExpressionAttributeValues: { ":playerId": playerId },
      ProjectionExpression: "playerId, betId",
      ExclusiveStartKey: cursor,
      ConsistentRead: true,
    }));
    const requests = (page.Items ?? []).map((item) => ({ DeleteRequest: { Key: item } }));
    for (let offset = 0; offset < requests.length; offset += 25) {
      let pending = requests.slice(offset, offset + 25);
      do {
        const result = await dynamodb.send(new BatchWriteCommand({ RequestItems: { [betsTable]: pending } }));
        pending = result.UnprocessedItems?.[betsTable] ?? [];
      } while (pending.length > 0);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
}

export const handler = async (event) => {
  try {
    const claims = claimsFrom(event);
    const playerId = claims.sub;
    const method = event?.requestContext?.http?.method;

    if (method === "GET") {
      const result = await dynamodb.send(new GetCommand({ TableName: playersTable, Key: { playerId }, ConsistentRead: true }));
      return result.Item ? response(200, result.Item) : response(404, { error: "player_not_found" });
    }

    if (method === "POST") {
      const username = validUsername(claims.preferred_username) ?? claims.email.split("@")[0].slice(0, 32);
      const result = await dynamodb.send(new UpdateCommand({
        TableName: playersTable,
        Key: { playerId },
        UpdateExpression: "SET email = :email, username = :username, score = if_not_exists(score, :zero), createdAt = if_not_exists(createdAt, :createdAt)",
        ExpressionAttributeValues: { ":email": claims.email, ":username": username, ":zero": 0, ":createdAt": new Date().toISOString() },
        ReturnValues: "ALL_NEW",
      }));
      return response(200, result.Attributes);
    }

    if (method === "DELETE") {
      await deleteBets(playerId);
      await dynamodb.send(new DeleteCommand({ TableName: playersTable, Key: { playerId } }));
      return { statusCode: 204 };
    }

    return response(405, { error: "method_not_allowed" });
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") return response(404, { error: "player_not_found" });
    console.error("player_request_failed", error);
    return response(500, { error: "internal_error" });
  }
};
