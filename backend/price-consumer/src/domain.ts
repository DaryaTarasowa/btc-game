export enum BetDirection {
  Up = "up",
  Down = "down",
}

export enum BetStatus {
  Active = "active",
  Resolved = "resolved",
}

export enum BetResult {
  Won = "won",
  Lost = "lost",
}

export enum ResolutionWriteResult {
  Resolved = "resolved",
  AlreadyResolved = "already_resolved",
}

export enum MarketPriceGuardResult {
  Accepted = "accepted",
  NonIncreasingEventTimestamp = "non_increasing_event_timestamp",
  UnchangedPrice = "unchanged_price",
}

export enum MarketPriceProcessingResult {
  Stored = "stored",
  Skipped = "skipped",
}

export enum CoinbaseMessageType {
  Ticker = "ticker",
  Subscriptions = "subscriptions",
  Heartbeat = "heartbeat",
  Error = "error",
}
