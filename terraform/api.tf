resource "aws_apigatewayv2_api" "player" {
  name          = "btc-game-player-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["DELETE", "GET", "PATCH", "POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.player.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "btc-game-cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://${aws_cognito_user_pool.players.endpoint}"
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
  api_id             = aws_apigatewayv2_api.player.id
  route_key          = "POST /players"
  target             = "integrations/${aws_apigatewayv2_integration.create_player.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
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

resource "aws_apigatewayv2_route" "get_player" {
  api_id             = aws_apigatewayv2_api.player.id
  route_key          = "GET /players/me"
  target             = "integrations/${aws_apigatewayv2_integration.create_player.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "api_get_player" {
  statement_id  = "AllowPlayerApiInvokeGetPlayer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_player.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.player.execution_arn}/*/GET/players/me"
}

resource "aws_apigatewayv2_route" "update_player" {
  api_id             = aws_apigatewayv2_api.player.id
  route_key          = "PATCH /players/me"
  target             = "integrations/${aws_apigatewayv2_integration.create_player.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_player" {
  api_id             = aws_apigatewayv2_api.player.id
  route_key          = "DELETE /players/me"
  target             = "integrations/${aws_apigatewayv2_integration.create_player.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "api_manage_player" {
  statement_id  = "AllowPlayerApiInvokeManagePlayer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_player.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.player.execution_arn}/*/*/players/me"
}

resource "aws_apigatewayv2_integration" "get_prices" {
  api_id                 = aws_apigatewayv2_api.player.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_prices.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 3000
}

resource "aws_apigatewayv2_route" "get_prices" {
  api_id    = aws_apigatewayv2_api.player.id
  route_key = "GET /prices"
  target    = "integrations/${aws_apigatewayv2_integration.get_prices.id}"
}

resource "aws_lambda_permission" "api_get_prices" {
  statement_id  = "AllowPlayerApiInvokeGetPrices"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_prices.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.player.execution_arn}/*/GET/prices"
}

resource "aws_apigatewayv2_integration" "create_bet" {
  api_id                 = aws_apigatewayv2_api.player.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.create_bet.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 3000
}

resource "aws_apigatewayv2_route" "create_bet" {
  api_id             = aws_apigatewayv2_api.player.id
  route_key          = "POST /bets"
  target             = "integrations/${aws_apigatewayv2_integration.create_bet.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "api_create_bet" {
  statement_id  = "AllowPlayerApiInvokeCreateBet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_bet.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.player.execution_arn}/*/POST/bets"
}
