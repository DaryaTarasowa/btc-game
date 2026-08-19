output "player_api_url" {
  description = "Base URL for the player HTTP API."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "create_player_url" {
  description = "Frontend endpoint that creates a player."
  value       = "${aws_apigatewayv2_stage.default.invoke_url}players"
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
