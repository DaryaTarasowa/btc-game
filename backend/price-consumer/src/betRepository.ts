import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { BetDirection, BetResult, BetStatus, ResolutionWriteResult } from "./domain.js";

export interface ActiveBet {
  betId: string;
  playerId: string;
  product: string;
  direction: BetDirection;
  status: BetStatus.Active;
  startPrice: string;
  startEventTimestamp: string;
  resolutionTargetTimestamp: string;
  createdAt: string;
}

export interface BetResolution {
  endPrice: string;
  endEventTimestamp: string;
  result: BetResult;
}

export { ResolutionWriteResult };

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
            ":active": BetStatus.Active,
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
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { playerId: bet.playerId, betId: bet.betId },
                UpdateExpression:
                  "SET #status = :resolved, endPrice = :endPrice, endEventTimestamp = :endEventTimestamp, #result = :result",
                ConditionExpression: "#status = :active",
                ExpressionAttributeNames: {
                  "#status": "status",
                  "#result": "result",
                },
                ExpressionAttributeValues: {
                  ":active": BetStatus.Active,
                  ":resolved": BetStatus.Resolved,
                  ":endPrice": resolution.endPrice,
                  ":endEventTimestamp": resolution.endEventTimestamp,
                  ":result": resolution.result,
                },
              },
            },
            {
              Update: {
                TableName: this.playersTableName,
                Key: { playerId: bet.playerId },
                UpdateExpression: "REMOVE activeBetId ADD #score :scoreChange",
                ConditionExpression: "activeBetId = :id",
                ExpressionAttributeNames: { "#score": "score" },
                ExpressionAttributeValues: {
                  ":id": bet.betId,
                  ":scoreChange": resolution.result === BetResult.Won ? 1 : -1,
                },
              },
            },
          ],
        }),
      );
      return ResolutionWriteResult.Resolved;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException" &&
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons) &&
        error.CancellationReasons.some(
          (reason: { Code?: string }) =>
            reason.Code === "ConditionalCheckFailed",
        )
      ) {
        return ResolutionWriteResult.AlreadyResolved;
      }
      throw error;
    }
  }
}
