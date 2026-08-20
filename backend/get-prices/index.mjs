import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { requestedPriceWindow, toPriceResponse } from "./prices.mjs";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.PRICE_HISTORY_TABLE;
const products = new Set((process.env.MARKET_PRODUCTS ?? "").split(",").map((product) => product.trim()).filter(Boolean));

async function queryPriceHistory(product, start, end) {
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
          ":product": product,
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

export const handler = async (event) => {
  const product = event?.queryStringParameters?.product;
  if (typeof product !== "string" || !products.has(product)) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "unsupported_product" }),
    };
  }
  const window = requestedPriceWindow(event?.queryStringParameters ?? {});
  if (!window) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "invalid_price_window" }),
    };
  }
  const { start, end } = window;
  const items = await queryPriceHistory(product, start, end);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toPriceResponse(product, items)),
  };
};
