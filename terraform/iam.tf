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
  name                 = "createPlayer-role-6vbriwln"
  path                 = "/service-role/"
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
}

resource "aws_iam_policy" "create_player_basic_execution" {
  name = "AWSLambdaBasicExecutionRole-303a89bf-8479-406b-8eb5-440a2a9bea74"
  path = "/service-role/"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:${var.aws_region}:${var.account_id}:*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "create_player_basic_execution" {
  role       = aws_iam_role.create_player.name
  policy_arn = aws_iam_policy.create_player_basic_execution.arn
}

resource "aws_iam_role_policy" "create_player_dynamodb" {
  name = "createPlayer-dynamodb"
  role = aws_iam_role.create_player.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "dynamodb:PutItem"
      Resource = aws_dynamodb_table.players.arn
    }]
  })
}

resource "aws_iam_role" "create_user" {
  name                 = "createUser-execution-role"
  path                 = "/"
  description          = "Allows Lambda functions to call AWS services on your behalf."
  assume_role_policy   = local.lambda_trust_policy
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "create_user" {
  name = "Policy"
  role = aws_iam_role.create_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "dynamodb:PutItem"
      Resource = aws_dynamodb_table.players.arn
    }]
  })
}
