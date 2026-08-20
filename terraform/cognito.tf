resource "aws_cognito_user_pool" "players" {
  name                = "btc-game-players"
  username_attributes = ["email"]

  lambda_config {
    pre_sign_up = aws_lambda_function.confirm_player_sign_up.arn
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }

  schema {
    attribute_data_type = "String"
    mutable             = true
    name                = "preferred_username"
    required            = false

    string_attribute_constraints {
      min_length = 2
      max_length = 32
    }
  }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name                          = "btc-game-frontend"
  user_pool_id                  = aws_cognito_user_pool.players.id
  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 1
  id_token_validity             = 1
  refresh_token_validity        = 30
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  read_attributes               = ["email", "preferred_username"]
  write_attributes              = ["email", "preferred_username"]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
