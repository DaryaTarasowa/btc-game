import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import type { MarketPriceEventData } from "./types.js";

export const PRICE_HISTORY_RETENTION_SECONDS = 10 * 60;

export interface PriceHistoryItem {
  product: string;
  sourceTimestamp: string;
  price: string;
  expiresAt: number;
}

export function toPriceHistoryItem(
  marketPrice: MarketPriceEventData,
  retentionSeconds = PRICE_HISTORY_RETENTION_SECONDS,
): PriceHistoryItem {
  const sourceTimeMs = Date.parse(marketPrice.eventTimestamp);
  if (!Number.isFinite(sourceTimeMs)) {
    throw new Error(`Invalid sourceTimestamp: ${marketPrice.eventTimestamp}`);
  }

  return {
    product: marketPrice.product,
    sourceTimestamp: marketPrice.eventTimestamp,
    price: marketPrice.price,
    expiresAt: Math.floor(sourceTimeMs / 1_000) + retentionSeconds,
  };
}

export class DynamoDbPriceHistoryRepository {
  private readonly client: DynamoDBDocumentClient;

  public constructor(
    private readonly tableName: string,
    client?: DynamoDBDocumentClient,
  ) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  public async put(update: MarketPriceEventData): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toPriceHistoryItem(update),
      }),
    );
  }

  public async getLatestSourceTimestamp(
    product: string,
  ): Promise<string | undefined> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#product = :product",
        ExpressionAttributeNames: { "#product": "product" },
        ExpressionAttributeValues: { ":product": product },
        ProjectionExpression: "sourceTimestamp",
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    const sourceTimestamp = result.Items?.[0]?.sourceTimestamp;
    return typeof sourceTimestamp === "string" ? sourceTimestamp : undefined;
  }
}
