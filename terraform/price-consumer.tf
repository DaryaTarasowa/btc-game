data "aws_vpcs" "default" {
  filter {
    name   = "is-default"
    values = ["true"]
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [one(data.aws_vpcs.default.ids)]
  }
}

locals {
  price_consumer_name = "btc-game-price-consumer"

  ecs_task_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_ecr_repository" "price_consumer" {
  name                 = local.price_consumer_name
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "price_consumer" {
  repository = aws_ecr_repository.price_consumer.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Remove untagged images after seven days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 7
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_cloudwatch_log_group" "price_consumer" {
  name              = "/aws/ecs/${local.price_consumer_name}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "application" {
  name = "btc-game-application"
}

resource "aws_security_group" "price_consumer" {
  name        = local.price_consumer_name
  description = "Outbound-only access for the BTC price consumer."
  vpc_id      = one(data.aws_vpcs.default.ids)

  egress {
    description = "HTTPS and secure WebSocket traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = local.price_consumer_name
    Application = "btc-game"
  }
}

resource "aws_iam_role" "price_consumer_execution" {
  name                 = "${local.price_consumer_name}-execution"
  description          = "ECS execution role for the BTC price consumer."
  assume_role_policy   = local.ecs_task_trust_policy
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role_policy" "price_consumer_execution" {
  name = "${local.price_consumer_name}-execution"
  role = aws_iam_role.price_consumer_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = aws_ecr_repository.price_consumer.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.price_consumer.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role" "price_consumer_task" {
  name                 = "${local.price_consumer_name}-task"
  description          = "Runtime role for the BTC price consumer."
  assume_role_policy   = local.ecs_task_trust_policy
  permissions_boundary = local.runtime_permissions_boundary_arn
}

resource "aws_iam_role_policy" "price_consumer_task" {
  name = "${local.price_consumer_name}-task"
  role = aws_iam_role.price_consumer_task.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.price_history.arn
      },
      {
        Effect   = "Allow"
        Action   = "appsync:EventPublish"
        Resource = aws_appsync_channel_namespace.prices.channel_namespace_arn
      }
    ]
  })
}

# Task-definition revisions are release-owned. Forget the legacy Terraform
# state entry without deregistering the existing ECS revision.
removed {
  from = aws_ecs_task_definition.price_consumer

  lifecycle {
    destroy = false
  }
}

resource "aws_ecs_service" "price_consumer" {
  name            = local.price_consumer_name
  cluster         = aws_ecs_cluster.application.id
  task_definition = var.price_consumer_initial_task_definition_arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.price_consumer.id]
    assign_public_ip = true
  }

  # Application releases select an immutable task-definition revision and set
  # the operational count. Infrastructure applies must not roll either back.
  lifecycle {
    ignore_changes = [
      desired_count,
      task_definition,
    ]
  }
}
