import assert from "node:assert/strict";
import test from "node:test";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  PriceHistoryRepository,
  PRICE_HISTORY_RETENTION_SECONDS,
  toPriceHistoryItem,
} from "./priceHistoryRepository.js";
import type { MarketPriceEventData } from "./types.js";

test("maps a sampled point to the DynamoDB shape with a ten-minute TTL", () => {
  const point: MarketPriceEventData = {
    product: "BTC-USD",
    price: "59432.10",
    eventTimestamp: "2026-08-18T18:30:12.123456Z",
    receivedTimestamp: "2026-08-18T18:30:12.140Z",
  };
  assert.deepEqual(toPriceHistoryItem(point), {
    product: "BTC-USD",
    sourceTimestamp: point.eventTimestamp,
    price: "59432.10",
    expiresAt:
      Math.floor(Date.parse(point.eventTimestamp) / 1_000) +
      PRICE_HISTORY_RETENTION_SECONDS,
  });
});

test("rejects an invalid source timestamp during item mapping", () => {
  const point: MarketPriceEventData = {
    product: "BTC-USD",
    price: "1",
    eventTimestamp: "invalid",
    receivedTimestamp: "2026-08-18T18:30:12.140Z",
  };
  assert.throws(() => toPriceHistoryItem(point), /Invalid sourceTimestamp/);
});

test("queries the newest product item once using descending sort-key order", async () => {
  const commands: unknown[] = [];
  const client = {
    send: async (command: unknown) => {
      commands.push(command);
      return { Items: [{ sourceTimestamp: "2026-08-18T18:30:12.100Z" }] };
    },
  } as unknown as DynamoDBDocumentClient;
  const repository = new PriceHistoryRepository(
    "btc-game-price-history",
    client,
  );

  assert.equal(
    await repository.getLatestSourceTimestamp("BTC-USD"),
    "2026-08-18T18:30:12.100Z",
  );
  assert.equal(commands.length, 1);
  const command = commands[0];
  assert.ok(command instanceof QueryCommand);
  assert.deepEqual(command.input, {
    TableName: "btc-game-price-history",
    KeyConditionExpression: "#product = :product",
    ExpressionAttributeNames: { "#product": "product" },
    ExpressionAttributeValues: { ":product": "BTC-USD" },
    ProjectionExpression: "sourceTimestamp",
    ScanIndexForward: false,
    Limit: 1,
  });
});
