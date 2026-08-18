# BTC game

Small serverless application deployed in `eu-central-1`.

## Repository layout

```text
frontend/
  React/Vite application
backend/
  create-player/
    Lambda source code
terraform/
  Infrastructure definitions and deployment workflow
```

## Architecture

- Amplify Hosting serves explicitly uploaded local Vite builds from the `main` branch.
- API Gateway exposes `POST /players`.
- `createPlayer` generates a UUID and writes the new player to DynamoDB.
- DynamoDB stores players and guesses using on-demand billing.
- Terraform manages application resources and application execution identities.
- Terraform does not manage developer IAM users, credentials, or deployment permissions.

## Safety

Terraform creates a clean, namespaced application stack. Remove manually created resources that conflict with the configured names before applying, and review every saved plan for unexpected replacements or deletions.

## Deployment identity prerequisite

Running Terraform requires an AWS identity with the permissions represented by [`terraform/bootstrap/btc-game-developer-policy.template.json`](terraform/bootstrap/btc-game-developer-policy.template.json), or equivalent permissions. An AWS administrator must substitute the target partition, region, and account ID before provisioning it.

The deployment identity must be provisioned outside this Terraform configuration before running the deployment workflow. Terraform intentionally manages only application infrastructure and runtime identities, not the identity used to deploy the application.

The bootstrap policy is deployment-capable and limited to the stable, namespaced application resources. Protect its credentials and always review the Terraform plan before applying it.

See `terraform/README.md` for the deployment workflow.

1. Render the policy
$templatePath = Resolve-Path ".\terraform\bootstrap\btc-game-developer-policy.template.json"
$renderedPath = Join-Path (Resolve-Path ".\work") "btc-game-developer-policy.rendered.json"

$policy = Get-Content $templatePath -Raw
$policy = $policy.Replace('${AWS_PARTITION}', 'aws')
$policy = $policy.Replace('${AWS_REGION}', 'eu-central-1')
$policy = $policy.Replace('${AWS_ACCOUNT_ID}', '599243103143')

$policy | ConvertFrom-Json | Out-Null
Set-Content `
  -LiteralPath $renderedPath `
  -Value $policy `
  -Encoding ascii

work/ is ignored by Git, so the rendered account-specific document will not be committed.
2. Create and attach the managed policy
Using administrator AWS credentials:
$policyArn = aws iam create-policy `
  --policy-name btc-game-developer `
  --description "Deploy the BTC game application infrastructure" `
  --policy-document "file://$renderedPath" `
  --query "Policy.Arn" `
  --output text

aws iam attach-user-policy `
  --user-name btc-game-developer `
  --policy-arn $policyArn
The resulting ARN should be:
arn:aws:iam::599243103143:policy/btc-game-developer
If that managed policy already exists, update it instead:
$policyArn = "arn:aws:iam::599243103143:policy/btc-game-developer"

aws iam create-policy-version `
  --policy-arn $policyArn `
  --policy-document "file://$renderedPath" `
  --set-as-default

aws iam attach-user-policy `
  --user-name btc-game-developer `
  --policy-arn $policyArn
The policy includes deployment and manual Amplify-upload permissions and is capable of creating and deleting the scoped application resources.
Once you confirm it is attached, I’ll generate a fresh plan. Based on current state, it should contain the remaining 10 creates only; I’ll verify that from the saved plan rather than assume it.
