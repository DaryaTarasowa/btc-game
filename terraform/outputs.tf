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

output "amplify_branch_url" {
  value = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.frontend.default_domain}"
}
