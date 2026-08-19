resource "aws_appsync_api" "live_prices" {
  name = "btc-game-live-prices"

  event_config {
    auth_provider {
      auth_type = "AWS_IAM"
    }

    auth_provider {
      auth_type = "API_KEY"
    }

    connection_auth_mode {
      auth_type = "API_KEY"
    }

    default_publish_auth_mode {
      auth_type = "AWS_IAM"
    }

    default_subscribe_auth_mode {
      auth_type = "API_KEY"
    }
  }
}

resource "aws_appsync_channel_namespace" "prices" {
  api_id = aws_appsync_api.live_prices.api_id
  name   = "prices"

  publish_auth_mode {
    auth_type = "AWS_IAM"
  }

  subscribe_auth_mode {
    auth_type = "API_KEY"
  }
}

resource "aws_appsync_api_key" "live_price_frontend" {
  api_id      = aws_appsync_api.live_prices.api_id
  description = "Browser subscription key for BTC game live prices."
  expires     = "2027-08-19T00:00:00Z"
}
