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

Terraform uses a deployment identity that is separate from the runtime identities used by the application:

```text
AWS administrator (one time)
    -> creates and configures btc-game-developer
    -> creates the runtime permissions-boundary policy
    -> creates and attaches the deployment policy

btc-game-developer
    -> runs Terraform
    -> Terraform creates btc-game-* application resources
    -> Terraform creates least-privilege runtime roles with the required boundary
```

The boundary is a maximum permission set; it does not grant permissions by itself. Terraform assigns each runtime role a workload-specific policy, and the role receives only permissions allowed by both that policy and the boundary.

The deployment user, its login configuration, the deployment policy, and the runtime boundary policy remain external bootstrap resources. Terraform does not create, import, update, or delete them.

The initial IAM setup must be performed once by an **AWS administrator**. If the deployment user and both bootstrap policies are already configured, skip to [Log in to AWS](#log-in-to-aws). Existing installations that predate the runtime boundary require one final administrator update before Terraform can migrate the current runtime roles onto the boundary.

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

### Create the runtime boundary and deployment policies

The external bootstrap policies are defined in:

```text
terraform/bootstrap/btc-game-runtime-boundary-policy.template.json
terraform/bootstrap/btc-game-developer-policy.template.json
```

While authenticated as an **AWS administrator**, run from the repository root:

```powershell
node scripts/bootstrap-aws.mjs --iam-user btc-game-developer --region eu-central-1
```

The script verifies the active administrator identity, renders templates for the selected account and region, and creates or safely updates the `btc-game-runtime-boundary` and `btc-game-developer` customer-managed policies. It attaches only the deployment policy to the specified IAM user.

The script handles IAM's managed-policy version limit by deleting only the oldest non-default version when a version slot is required. Temporary rendered policy files are removed automatically. The options shown above are also the defaults, so `node scripts/bootstrap-aws.mjs` is equivalent.

After this bootstrap, normal Terraform additions using the supported `btc-game-*` DynamoDB, Lambda, IAM runtime-role, ECS/Fargate, ECR, logging, API Gateway, and Amplify scopes do not require administrator intervention. Adding a new AWS service or expanding the maximum permissions available to runtime workloads still requires an administrator to review and update the external boundary or deployment policy.

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
node scripts/deploy-frontend.mjs
```

The script builds the Vite application, reads the API and Amplify configuration from Terraform outputs, and deploys the frontend to Amplify.

If dependencies are already installed:

```powershell
node scripts/deploy-frontend.mjs --skip-install
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
node scripts/deploy-frontend.mjs --skip-install
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
