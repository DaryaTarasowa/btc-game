variable "aws_region" {
  description = "AWS region for the application."
  type        = string
  default     = "eu-central-1"
}

variable "account_id" {
  description = "AWS account that owns the imported resources."
  type        = string
  default     = "599243103143"
}

variable "enable_new_infrastructure" {
  description = "Create API Gateway and Amplify resources after existing-resource adoption is reviewed."
  type        = bool
  default     = false
}

variable "github_repository_url" {
  description = "Public GitHub repository connected to Amplify Hosting."
  type        = string
  default     = null
  nullable    = true
}

variable "github_access_token" {
  description = "One-time GitHub token used by Amplify to create its webhook and deploy key. Remove after initial setup."
  type        = string
  default     = null
  nullable    = true
  sensitive   = true
}
