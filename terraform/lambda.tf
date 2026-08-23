data "archive_file" "confirm_player_sign_up" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/confirm-player-sign-up"
  output_path = "${path.module}/confirmPlayerSignUp.zip"
}

resource "aws_lambda_function" "confirm_player_sign_up" {
  function_name = "btc-game-confirm-player-sign-up"
  role          = aws_iam_role.confirm_player_sign_up.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3
  package_type  = "Zip"

  filename         = data.archive_file.confirm_player_sign_up.output_path
  source_code_hash = data.archive_file.confirm_player_sign_up.output_base64sha256
}

resource "aws_lambda_permission" "cognito_confirm_player_sign_up" {
  statement_id  = "AllowCognitoInvokePreSignUp"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.confirm_player_sign_up.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.players.arn
}

data "archive_file" "create_player" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/create-player"
  output_path = "${path.module}/createPlayer.zip"
}

resource "aws_lambda_function" "create_player" {
  function_name = "btc-game-create-player"
  role          = aws_iam_role.create_player.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3
  package_type  = "Zip"

  filename         = data.archive_file.create_player.output_path
  source_code_hash = data.archive_file.create_player.output_base64sha256

  environment {
    variables = {
      PLAYERS_TABLE = aws_dynamodb_table.players.name
      BETS_TABLE    = aws_dynamodb_table.bets.name
    }
  }
}

data "archive_file" "get_prices" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/get-prices"
  output_path = "${path.module}/getPrices.zip"
}

resource "aws_lambda_function" "get_prices" {
  function_name = "btc-game-price-history-reader"
  role          = aws_iam_role.get_prices.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3
  package_type  = "Zip"

  filename         = data.archive_file.get_prices.output_path
  source_code_hash = data.archive_file.get_prices.output_base64sha256

  environment {
    variables = {
      PRICE_HISTORY_TABLE = aws_dynamodb_table.price_history.name
      MARKET_PRODUCTS     = join(",", var.market_products)
    }
  }
}

data "archive_file" "bets" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/bets"
  output_path = "${path.module}/bets.zip"
}

resource "aws_lambda_function" "bets" {
  function_name = "btc-game-bets"
  role          = aws_iam_role.bets.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 3
  package_type  = "Zip"

  filename         = data.archive_file.bets.output_path
  source_code_hash = data.archive_file.bets.output_base64sha256

  environment {
    variables = {
      BETS_TABLE          = aws_dynamodb_table.bets.name
      PLAYERS_TABLE       = aws_dynamodb_table.players.name
      PRICE_HISTORY_TABLE = aws_dynamodb_table.price_history.name
      MARKET_PRODUCTS     = join(",", var.market_products)
    }
  }
}
