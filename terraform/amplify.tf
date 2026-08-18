resource "aws_amplify_app" "frontend" {
  name     = "btc-game-frontend"
  platform = "WEB"

  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"
  stage       = "PRODUCTION"
  framework   = "React"

  enable_auto_build = false
}
