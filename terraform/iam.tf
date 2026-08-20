data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  runtime_permissions_boundary_arn = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/btc-game-runtime-boundary"

  lambda_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role" "create_player" {
  name                 = "btc-game-create-player"
  description          = "Runtime role for the BTC game player-creation Lambda."
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role" "confirm_player_sign_up" {
  name                 = "btc-game-confirm-player-sign-up"
  description          = "Runtime role for automatically confirming BTC game registrations."
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role_policy" "confirm_player_sign_up_runtime" {
  name = "btc-game-confirm-player-sign-up-runtime"
  role = aws_iam_role.confirm_player_sign_up.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/btc-game-confirm-player-sign-up:*"
    }]
  })
}

resource "aws_iam_role_policy" "create_player_runtime" {
  name = "btc-game-create-player-runtime"
  role = aws_iam_role.create_player.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/btc-game-create-player:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.players.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:BatchWriteItem", "dynamodb:Query"]
        Resource = aws_dynamodb_table.bets.arn
      }
    ]
  })
}

resource "aws_iam_role" "get_prices" {
  name                 = "btc-game-price-history-reader"
  description          = "Runtime role for the BTC game price-history reader Lambda."
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role_policy" "get_prices_runtime" {
  name = "btc-game-price-history-reader-runtime"
  role = aws_iam_role.get_prices.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/btc-game-price-history-reader:*"
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:Query"
        Resource = aws_dynamodb_table.price_history.arn
      }
    ]
  })
}

resource "aws_iam_role" "create_bet" {
  name                 = "btc-game-create-bet"
  description          = "Runtime role for the BTC game bet-creation Lambda."
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role_policy" "create_bet_runtime" {
  name = "btc-game-create-bet-runtime"
  role = aws_iam_role.create_bet.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/btc-game-create-bet:*"
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:GetItem"
        Resource = aws_dynamodb_table.price_history.arn
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:PutItem"
        Resource = aws_dynamodb_table.bets.arn
      }
    ]
  })
}
