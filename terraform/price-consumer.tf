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
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:Query"
        Resource = "${aws_dynamodb_table.bets.arn}/index/status-resolution-target-index"
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:UpdateItem"
        Resource = aws_dynamodb_table.bets.arn
      },
      {
        Effect   = "Allow"
        Action   = "dynamodb:UpdateItem"
        Resource = aws_dynamodb_table.players.arn
      },
      {
        Effect = "Allow"
        Action = "dynamodb:TransactWriteItems"
        Resource = [
          aws_dynamodb_table.bets.arn,
          aws_dynamodb_table.players.arn
        ]
      }
    ]
  })
}

resource "aws_ecs_task_definition" "price_consumer_bootstrap" {
  family                   = "${local.price_consumer_name}-bootstrap"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.price_consumer_execution.arn
  task_role_arn            = aws_iam_role.price_consumer_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name        = "price-consumer"
      image       = "${aws_ecr_repository.price_consumer.repository_url}:bootstrap"
      essential   = true
      stopTimeout = 30

      environment = [
        {
          name  = "PRICE_HISTORY_TABLE"
          value = aws_dynamodb_table.price_history.name
        },
        {
          name  = "APPSYNC_EVENTS_ENDPOINT"
          value = "https://${aws_appsync_api.live_prices.dns["HTTP"]}/event"
        },
        {
          name  = "APPSYNC_REGION"
          value = var.aws_region
        },
        {
          name  = "BETS_TABLE"
          value = aws_dynamodb_table.bets.name
        },
        {
          name  = "PLAYERS_TABLE"
          value = aws_dynamodb_table.players.name
        },
        {
          name  = "MARKET_PRODUCTS"
          value = join(",", var.market_products)
        },
        {
          name  = "COINBASE_CHANNELS"
          value = join(",", var.coinbase_channels)
        },
        {
          name  = "APPSYNC_EVENTS_CHANNEL_PREFIX"
          value = var.live_price_channel_prefix
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.price_consumer.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "price-consumer"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "price_consumer" {
  name            = local.price_consumer_name
  cluster         = aws_ecs_cluster.application.id
  task_definition = aws_ecs_task_definition.price_consumer_bootstrap.arn
  desired_count   = 0
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

  lifecycle {
    ignore_changes = [
      desired_count,
      task_definition,
    ]
  }
}
