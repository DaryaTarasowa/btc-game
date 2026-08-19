resource "aws_dynamodb_table" "players" {
  name         = "btc-game-players"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "playerId"
  table_class  = "STANDARD"

  attribute {
    name = "playerId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "guesses" {
  name         = "btc-game-guesses"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "playerId"
  range_key    = "createdAt"
  table_class  = "STANDARD"

  attribute {
    name = "playerId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "eligibleAt"
    type = "S"
  }

  global_secondary_index {
    name            = "status-eligible-at-index"
    hash_key        = "status"
    range_key       = "eligibleAt"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "bets" {
  name         = "btc-game-bets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "playerId"
  range_key    = "recordKey"
  table_class  = "STANDARD"

  attribute {
    name = "playerId"
    type = "S"
  }

  attribute {
    name = "recordKey"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "resolutionTargetTimestamp"
    type = "S"
  }

  global_secondary_index {
    name            = "status-resolution-target-index"
    hash_key        = "status"
    range_key       = "resolutionTargetTimestamp"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "price_history" {
  name         = "btc-game-price-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "product"
  range_key    = "sourceTimestamp"
  table_class  = "STANDARD"

  attribute {
    name = "product"
    type = "S"
  }

  attribute {
    name = "sourceTimestamp"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}
