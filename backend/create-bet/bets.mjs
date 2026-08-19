const PRODUCT = "BTC-USD";
const ACTIVE_RECORD_KEY = "ACTIVE";
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

  const { playerId, direction, startPrice, startEventTimestamp } = value;
  if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
    throw new BetCreationError("invalid_player_id", 400, "playerId must be a UUID.");
  }
  if (direction !== "up" && direction !== "down") {
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

  return { playerId, direction, startPrice, startEventTimestamp };
}

export function addSixtySeconds(timestamp) {
  const match = TIMESTAMP_PATTERN.exec(timestamp);
  if (!match) throw new Error("Cannot calculate a target from an invalid timestamp.");

  const target = new Date(Date.parse(timestamp) + 60_000).toISOString();
  const wholeSeconds = target.slice(0, 19);
  return match[1] ? `${wholeSeconds}.${match[1]}Z` : `${wholeSeconds}Z`;
}

export async function createBet(request, dependencies) {
  const input = validateCreateBetRequest(request);
  const historyPoint = await dependencies.getHistoryPoint(
    PRODUCT,
    input.startEventTimestamp,
  );

  if (!historyPoint) {
    throw new BetCreationError("history_point_not_found", 404, "The submitted market-history point does not exist.");
  }
  if (historyPoint.price !== input.startPrice) {
    throw new BetCreationError("history_price_mismatch", 409, "The submitted price does not match the stored history point.");
  }

  const bet = {
    id: dependencies.createId(),
    playerId: input.playerId,
    recordKey: ACTIVE_RECORD_KEY,
    direction: input.direction,
    status: "active",
    startPrice: input.startPrice,
    startEventTimestamp: input.startEventTimestamp,
    resolutionTargetTimestamp: addSixtySeconds(input.startEventTimestamp),
    createdAt: dependencies.now().toISOString(),
  };

  try {
    await dependencies.putActiveBet(bet);
  } catch (error) {
    if (dependencies.isDuplicateError(error)) {
      throw new BetCreationError("active_bet_exists", 409, "The player already has an active bet.");
    }
    throw error;
  }

  return bet;
}
