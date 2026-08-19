variable "aws_region" {
  description = "AWS region for the application."
  type        = string
  default     = "eu-central-1"
}

variable "price_consumer_initial_task_definition_arn" {
  description = "One-time task-definition ARN used only when creating the ECS service in a new environment. Omit after the service exists; release automation owns subsequent revisions."
  type        = string
  default     = null
  nullable    = true
}
