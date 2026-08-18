resource "aws_amplify_app" "frontend" {
  count = var.enable_new_infrastructure ? 1 : 0

  name         = "btc-game-frontend"
  platform     = "WEB"
  repository   = var.github_repository_url
  access_token = var.github_access_token

  enable_branch_auto_build = true

  environment_variables = {
    VITE_CREATE_USER_URL = "${aws_apigatewayv2_stage.default[0].invoke_url}/players"
  }

  build_spec = <<-YAML
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - corepack enable
            - pnpm install --frozen-lockfile
        build:
          commands:
            - pnpm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .pnpm-store/**/*
  YAML

  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }
}

resource "aws_amplify_branch" "main" {
  count = var.enable_new_infrastructure ? 1 : 0

  app_id      = aws_amplify_app.frontend[0].id
  branch_name = "main"
  stage       = "PRODUCTION"
  framework   = "React"

  enable_auto_build = true
}
