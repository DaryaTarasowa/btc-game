variable "aws_region" {
  description = "AWS region for the application."
  type        = string
  default     = "eu-central-1"
}

variable "price_consumer_image_tag" {
  description = "Immutable ECR image tag for the price consumer. Null creates the service at desired count zero for initial ECR bootstrap."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.price_consumer_image_tag == null || can(regex("^[A-Za-z0-9_.-]{1,128}$", var.price_consumer_image_tag))
    error_message = "price_consumer_image_tag must be null or a valid ECR image tag."
  }
}
