resource "aws_apigatewayv2_api" "player" {
  name          = "btc-game-player-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "create_player" {
  api_id                 = aws_apigatewayv2_api.player.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.create_player.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 3000
}

resource "aws_apigatewayv2_route" "create_player" {
  api_id    = aws_apigatewayv2_api.player.id
  route_key = "POST /players"
  target    = "integrations/${aws_apigatewayv2_integration.create_player.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.player.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }
}

resource "aws_lambda_permission" "api_create_player" {
  statement_id  = "AllowPlayerApiInvokeCreatePlayer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_player.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.player.execution_arn}/*/POST/players"
}
