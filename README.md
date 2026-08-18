# BTC game

A small serverless BTC prediction game deployed on AWS.

## Architecture

- React/Vite frontend hosted on AWS Amplify
- HTTP API provided by API Gateway
- Serverless backend using AWS Lambda
- DynamoDB for application data
- Infrastructure managed with Terraform

The application is deployed to `eu-central-1`.

## Known limitations

Player identity is currently anonymous and stored only in the browser's `localStorage`.

Clearing site data or using a different browser or device loses access to the existing player identity. The player record remains in DynamoDB, but there is currently no account recovery mechanism.

Persistent authentication and account recovery are intentionally out of scope for the current implementation.

## Repository

```text
frontend/    React/Vite application
backend/     Serverless backend
terraform/   AWS infrastructure
scripts/     Deployment scripts
```

## Prerequisites

Install locally:

- Terraform 1.15+
- AWS CLI v2 with `aws login` support
- Node.js
- pnpm

## AWS setup

Terraform requires an IAM deployment user with permission to manage the application's AWS resources.

The initial IAM setup must be performed once by an **AWS administrator**. If the deployment user is already configured, skip to [Log in to AWS](#log-in-to-aws).

<details>
<summary>First-time IAM setup</summary>

### Create a deployment user

In the AWS Console, open:

**IAM → Users → Create user**

Create an IAM user for deploying the application, for example:

```text
btc-game-developer
```

Do not create an access key. The deployment user authenticates through `aws login`.

Attach the AWS-managed policy:

```text
SignInLocalDevelopmentAccess
```

### Create the application deployment policy

The required deployment permissions are defined in:

```text
terraform/bootstrap/btc-game-developer-policy.template.json
```

From the `terraform/` directory, while authenticated as an **AWS administrator**:

```powershell
$IamUserName = "btc-game-developer"
$AwsRegion = "eu-central-1"
$AwsPartition = "aws"
$AwsAccountId = aws sts get-caller-identity --query Account --output text
$PolicyName = "btc-game-developer"
$RenderedPolicy = "bootstrap/btc-game-developer-policy.json"

(Get-Content "bootstrap/btc-game-developer-policy.template.json" -Raw) `
  .Replace('${AWS_PARTITION}', $AwsPartition) `
  .Replace('${AWS_REGION}', $AwsRegion) `
  .Replace('${AWS_ACCOUNT_ID}', $AwsAccountId) |
  Set-Content $RenderedPolicy
```

Create the managed policy:

```powershell
$PolicyArn = aws iam create-policy `
  --policy-name $PolicyName `
  --policy-document "file://$RenderedPolicy" `
  --query Policy.Arn `
  --output text
```

Attach it to the deployment user:

```powershell
aws iam attach-user-policy `
  --user-name $IamUserName `
  --policy-arn $PolicyArn
```

Remove the generated local policy:

```powershell
Remove-Item $RenderedPolicy
```

</details>

## Log in to AWS

Log in as the deployment user:

```powershell
aws login --profile btc-game-developer
```

Complete the sign-in flow in the browser and select the profile for the current PowerShell session:

```powershell
$env:AWS_PROFILE = "btc-game-developer"
```

Verify the active identity:

```powershell
aws sts get-caller-identity
```

The returned ARN should identify the deployment user:

```text
arn:aws:iam::<account-id>:user/btc-game-developer
```

Keep using this PowerShell session for the deployment commands below.

## Deploy

### Infrastructure

From `terraform/`:

```powershell
terraform init
terraform plan -out deployment.tfplan
```

Review the plan, then deploy it:

```powershell
terraform apply deployment.tfplan
```

View the deployed endpoints and resource identifiers:

```powershell
terraform output
```

### Frontend

From the repository root:

```powershell
.\scripts\deploy-frontend.ps1
```

The script builds the Vite application, reads the API and Amplify configuration from Terraform outputs, and deploys the frontend to Amplify.

If dependencies are already installed:

```powershell
.\scripts\deploy-frontend.ps1 -SkipInstall
```

## Updating the application

For infrastructure or backend changes, review and apply a new Terraform plan:

```powershell
cd terraform
terraform plan -out deployment.tfplan
terraform apply deployment.tfplan
```

For frontend-only changes:

```powershell
.\scripts\deploy-frontend.ps1 -SkipInstall
```

### Verify the deployment

Get the public frontend URL:

```powershell
cd terraform
terraform output frontend_url
```

Open the returned URL in a browser.

The page should show the login button. After clicking it, a player is created through the API and the page should display:

```text
You logged in with the id <UUID>
```

The UUID is stored in the browser's local storage, so refreshing the page should keep the player logged in.

## Safety

- Always review the Terraform plan before applying it.
- Generate a new plan after a partial or failed apply.
- Do not commit Terraform state, saved plans, AWS credentials, rendered IAM policies, environment secrets, or build artifacts.
