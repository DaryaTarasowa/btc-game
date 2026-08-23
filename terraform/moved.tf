moved {
  from = aws_lambda_function.create_bet
  to   = aws_lambda_function.bets
}

moved {
  from = aws_apigatewayv2_integration.create_bet
  to   = aws_apigatewayv2_integration.bets
}

moved {
  from = aws_iam_role.create_bet
  to   = aws_iam_role.bets
}

moved {
  from = aws_iam_role_policy.create_bet_runtime
  to   = aws_iam_role_policy.bets_runtime
}
