variable "aws_region" {
  description = "AWS region for the application."
  type        = string
  default     = "eu-central-1"
}

variable "market_products" {
  description = "Coinbase products ingested and available to the application."
  type        = list(string)
  default     = ["BTC-USD"]
}

variable "default_market_product" {
  description = "Product initially selected by the frontend."
  type        = string
  default     = "BTC-USD"
}

variable "coinbase_channels" {
  description = "Coinbase WebSocket channels subscribed by the price consumer."
  type        = list(string)
  default     = ["ticker", "heartbeat"]
}

variable "live_price_channel_prefix" {
  description = "AppSync Events channel prefix; the product is appended at runtime."
  type        = string
  default     = "/prices"
}

check "default_market_product_is_configured" {
  assert {
    condition     = contains(var.market_products, var.default_market_product)
    error_message = "default_market_product must be included in market_products."
  }
}
