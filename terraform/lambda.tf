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
