import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createPriceWindow, toPriceResponse } from "./prices.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.PRICE_HISTORY_TABLE;

async function queryPriceHistory(start, end) {
  const items = [];
  let exclusiveStartKey;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression:
          "#product = :product AND #sourceTimestamp BETWEEN :start AND :end",
        ExpressionAttributeNames: {
          "#product": "product",
          "#sourceTimestamp": "sourceTimestamp",
          "#price": "price",
        },
        ExpressionAttributeValues: {
          ":product": "BTC-USD",
          ":start": start,
          ":end": end,
        },
        ProjectionExpression: "#price, #sourceTimestamp",
        ScanIndexForward: true,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

export const handler = async () => {
  const { start, end } = createPriceWindow();
  const items = await queryPriceHistory(start, end);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toPriceResponse(items)),
  };
};
