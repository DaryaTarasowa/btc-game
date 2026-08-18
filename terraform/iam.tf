locals {
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
        Effect   = "Allow"
        Action   = "dynamodb:PutItem"
        Resource = aws_dynamodb_table.players.arn
      }
    ]
  })
}
