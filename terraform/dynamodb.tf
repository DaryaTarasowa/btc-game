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
