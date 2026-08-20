import { BetDirection, BetStatus } from "./domain.mjs";
const PLAYER_ID_PATTERN = /^[A-Za-z0-9._:@-]{1,128}$/;
const PRODUCT_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+$/;
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*)(?:\.\d+)?$|^0*\.\d*[1-9]\d*$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})$/;

export class BetCreationError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "BetCreationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function validateCreateBetRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BetCreationError("invalid_request", 400, "Request body must be an object.");
  }

  const { playerId, product, direction, startPrice, startEventTimestamp } = value;
  if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
    throw new BetCreationError("invalid_player_id", 400, "playerId is invalid.");
  }
  if (typeof product !== "string" || !PRODUCT_PATTERN.test(product)) {
    throw new BetCreationError("invalid_product", 400, "product is invalid.");
  }
  if (direction !== BetDirection.Up && direction !== BetDirection.Down) {
    throw new BetCreationError("invalid_direction", 400, "direction must be up or down.");
  }
  if (typeof startPrice !== "string" || !POSITIVE_DECIMAL_PATTERN.test(startPrice)) {
    throw new BetCreationError("invalid_start_price", 400, "startPrice must be a positive decimal string.");
  }
  if (
    typeof startEventTimestamp !== "string" ||
    !TIMESTAMP_PATTERN.test(startEventTimestamp) ||
    !Number.isFinite(Date.parse(startEventTimestamp))
  ) {
    throw new BetCreationError("invalid_start_timestamp", 400, "startEventTimestamp must be a valid timestamp.");
  }

  return { playerId, product, direction, startPrice, startEventTimestamp };
}

export function addSixtySeconds(timestamp) {
  const match = TIMESTAMP_PATTERN.exec(timestamp);
  if (!match) throw new Error("Cannot calculate a target from an invalid timestamp.");

  const target = new Date(Date.parse(timestamp) + 60_000).toISOString();
  const wholeSeconds = target.slice(0, 19);
  return match[1] ? `${wholeSeconds}.${match[1]}Z` : `${wholeSeconds}Z`;
}

export function createBetTransaction(bet, betsTable, playersTable) {
  return {
    TransactItems: [
      {
        Put: {
          TableName: betsTable,
          Item: bet,
          ConditionExpression: "attribute_not_exists(playerId) AND attribute_not_exists(betId)",
        },
      },
      {
        Update: {
          TableName: playersTable,
          Key: { playerId: bet.playerId },
          UpdateExpression: "SET activeBetId = :betId",
          ConditionExpression: "attribute_exists(playerId) AND attribute_not_exists(activeBetId)",
          ExpressionAttributeValues: { ":betId": bet.betId },
        },
      },
    ],
  };
}

export async function createBet(request, dependencies) {
  const input = validateCreateBetRequest(request);
  if (!dependencies.products.includes(input.product)) {
    throw new BetCreationError("unsupported_product", 400, "product is not configured.");
  }
  const historyPoint = await dependencies.getHistoryPoint(
    input.product,
    input.startEventTimestamp,
  );

  if (!historyPoint) {
    throw new BetCreationError("history_point_not_found", 404, "The submitted market-history point does not exist.");
  }
  if (historyPoint.price !== input.startPrice) {
    throw new BetCreationError("history_price_mismatch", 409, "The submitted price does not match the stored history point.");
  }

  const betId = dependencies.createId();
  const bet = {
    betId,
    playerId: input.playerId,
    product: input.product,
    direction: input.direction,
    status: BetStatus.Active,
    startPrice: input.startPrice,
    startEventTimestamp: input.startEventTimestamp,
    resolutionTargetTimestamp: addSixtySeconds(input.startEventTimestamp),
    createdAt: dependencies.now().toISOString(),
  };
  try {
    await dependencies.transactCreateBet(bet);
  } catch (error) {
    if (dependencies.isDuplicateError(error)) {
      throw new BetCreationError("active_bet_exists", 409, "The player already has an active bet.");
    }
    throw error;
  }

  return bet;
}
