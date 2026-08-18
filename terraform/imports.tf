import {
  to = aws_dynamodb_table.players
  id = "players"
}

import {
  to = aws_dynamodb_table.guesses
  id = "guesses"
}

import {
  to = aws_iam_role.create_player
  id = "createPlayer-role-6vbriwln"
}

import {
  to = aws_iam_policy.create_player_basic_execution
  id = "arn:aws:iam::599243103143:policy/service-role/AWSLambdaBasicExecutionRole-303a89bf-8479-406b-8eb5-440a2a9bea74"
}

import {
  to = aws_iam_role_policy_attachment.create_player_basic_execution
  id = "createPlayer-role-6vbriwln/arn:aws:iam::599243103143:policy/service-role/AWSLambdaBasicExecutionRole-303a89bf-8479-406b-8eb5-440a2a9bea74"
}

import {
  to = aws_iam_role.create_user
  id = "createUser-execution-role"
}

import {
  to = aws_iam_role_policy.create_user
  id = "createUser-execution-role:Policy"
}

import {
  to = aws_lambda_function.create_player
  id = "createPlayer"
}

import {
  to = aws_lambda_function.create_user
  id = "createUser"
}
