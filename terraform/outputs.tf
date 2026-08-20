output "player_api_url" {
  description = "Base URL for the player HTTP API."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "create_player_url" {
  description = "Frontend endpoint that creates a player."
  value       = "${aws_apigatewayv2_stage.default.invoke_url}players"
}

output "cognito_user_pool_id" {
  description = "Cognito user pool used by frontend authentication."
  value       = aws_cognito_user_pool.players.id
}

output "cognito_user_pool_client_id" {
  description = "Public Cognito app-client ID used by the frontend."
  value       = aws_cognito_user_pool_client.frontend.id
}

output "price_history_url" {
  description = "Frontend endpoint that returns recent BTC-USD price history."
  value       = "${aws_apigatewayv2_stage.default.invoke_url}prices"
}

output "create_bet_url" {
  description = "Frontend endpoint that creates a bet from an exact visible market point."
  value       = "${aws_apigatewayv2_stage.default.invoke_url}bets"
}

output "bets_table_name" {
  description = "DynamoDB table containing active and resolved bets."
  value       = aws_dynamodb_table.bets.name
}

output "players_table_name" {
  description = "DynamoDB table containing player scores."
  value       = aws_dynamodb_table.players.name
}

output "amplify_app_id" {
  value = aws_amplify_app.frontend.id
}

output "amplify_default_domain" {
  value = aws_amplify_app.frontend.default_domain
}

output "frontend_url" {
  value = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.frontend.default_domain}"
}

output "price_consumer_ecr_repository_url" {
  description = "ECR repository URL for the price-consumer image."
  value       = aws_ecr_repository.price_consumer.repository_url
}

output "price_consumer_ecs_cluster_name" {
  description = "ECS cluster running the price consumer."
  value       = aws_ecs_cluster.application.name
}

output "price_consumer_ecs_service_name" {
  description = "ECS service running the price consumer."
  value       = aws_ecs_service.price_consumer.name
}

output "price_consumer_log_group_name" {
  description = "CloudWatch log group for the price consumer."
  value       = aws_cloudwatch_log_group.price_consumer.name
}

output "live_price_event_api_id" {
  description = "AppSync Event API ID for live BTC prices."
  value       = aws_appsync_api.live_prices.api_id
}

output "live_price_event_http_endpoint" {
  description = "AppSync Events HTTP endpoint used by the price publisher."
  value       = "https://${aws_appsync_api.live_prices.dns["HTTP"]}/event"
}

output "live_price_event_realtime_endpoint" {
  description = "AppSync Events realtime endpoint used by browser subscribers."
  value       = "wss://${aws_appsync_api.live_prices.dns["REALTIME"]}/event/realtime"
}

output "live_price_event_api_key" {
  description = "API key for frontend live-price subscriptions."
  value       = aws_appsync_api_key.live_price_frontend.key
  sensitive   = true
}

output "live_price_event_namespace" {
  description = "AppSync Events namespace containing live-price channels."
  value       = aws_appsync_channel_namespace.prices.name
}

output "live_price_event_channel" {
  description = "AppSync Events channel for BTC-USD live prices."
  value       = "/prices/BTC-USD"
}
