output "player_api_url" {
  description = "Base URL for the player HTTP API."
  value       = var.enable_new_infrastructure ? aws_apigatewayv2_stage.default[0].invoke_url : null
}

output "create_player_url" {
  description = "Frontend endpoint that creates a player."
  value       = var.enable_new_infrastructure ? "${aws_apigatewayv2_stage.default[0].invoke_url}/players" : null
}

output "amplify_app_id" {
  value = var.enable_new_infrastructure ? aws_amplify_app.frontend[0].id : null
}

output "amplify_default_domain" {
  value = var.enable_new_infrastructure ? aws_amplify_app.frontend[0].default_domain : null
}

output "amplify_branch_url" {
  value = var.enable_new_infrastructure ? "https://${aws_amplify_branch.main[0].branch_name}.${aws_amplify_app.frontend[0].default_domain}" : null
}
