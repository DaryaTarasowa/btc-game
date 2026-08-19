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
    }
  }
}
