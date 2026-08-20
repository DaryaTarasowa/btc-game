import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

export interface ActiveBet {
  id: string;
  playerId: string;
  recordKey: "ACTIVE";
  direction: "up" | "down";
  status: "active";
  startPrice: string;
  startEventTimestamp: string;
  resolutionTargetTimestamp: string;
  createdAt: string;
}

export interface BetResolution {
  endPrice: string;
  endEventTimestamp: string;
  result: "won" | "lost";
}

export type ResolutionWriteResult = "resolved" | "already_resolved";

export interface BetStore {
  queryActiveThrough(upperBound: string): Promise<ActiveBet[]>;
  resolveBetConditionally(
    bet: ActiveBet,
    resolution: BetResolution,
  ): Promise<ResolutionWriteResult>;
}

const ACTIVE_INDEX = "status-resolution-target-index";

export class BetRepository implements BetStore {
  private readonly client: DynamoDBDocumentClient;

  public constructor(
    private readonly tableName: string,
    private readonly playersTableName: string,
    client?: DynamoDBDocumentClient,
  ) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  /**
   * Query all active bets due before upperBound. The ExclusiveStartKey allows to fetch multiple pages if necessary.
   */
  public async queryActiveThrough(upperBound: string): Promise<ActiveBet[]> {
    const bets: ActiveBet[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: ACTIVE_INDEX,
          KeyConditionExpression:
            "#status = :active AND #resolutionTargetTimestamp <= :upperBound",
          ExpressionAttributeNames: {
            "#status": "status",
            "#resolutionTargetTimestamp": "resolutionTargetTimestamp",
          },
          ExpressionAttributeValues: {
            ":active": "active",
            ":upperBound": upperBound,
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      bets.push(...((result.Items ?? []) as ActiveBet[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return bets;
  }

  public async resolveBetConditionally(
    bet: ActiveBet,
    resolution: BetResolution,
  ): Promise<ResolutionWriteResult> {
    const resolvedBet = {
      ...bet,
      ...resolution,
      recordKey: `BET#${bet.startEventTimestamp}#${bet.id}`,
      status: "resolved",
    };

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: { playerId: bet.playerId, recordKey: "ACTIVE" },
                ConditionExpression: "#status = :active AND #id = :id",
                ExpressionAttributeNames: { "#status": "status", "#id": "id" },
                ExpressionAttributeValues: {
                  ":active": "active",
                  ":id": bet.id,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: resolvedBet,
                ConditionExpression:
                  "attribute_not_exists(playerId) AND attribute_not_exists(recordKey)",
              },
            },
            {
              Update: {
                TableName: this.playersTableName,
                Key: { playerId: bet.playerId },
                UpdateExpression: "ADD #score :scoreChange",
                ConditionExpression: "attribute_exists(playerId)",
                ExpressionAttributeNames: { "#score": "score" },
                ExpressionAttributeValues: {
                  ":scoreChange": resolution.result === "won" ? 1 : -1,
                },
              },
            },
          ],
        }),
      );
      return "resolved";
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException" &&
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons) &&
        error.CancellationReasons[0]?.Code === "ConditionalCheckFailed"
      ) {
        return "already_resolved";
      }
      throw error;
    }
  }
}
