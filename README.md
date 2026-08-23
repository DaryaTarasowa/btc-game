# BTC game

A real-time BTC price prediction game built with React and an event-driven AWS backend.

## Contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Repository](#repository)
- [Prerequisites](#prerequisites)
- [Local development setup](#local-development-setup)
- [AWS setup](#aws-setup)
- [Updating the application](#updating-the-application)
- [Testing](#testing)
- [Safety](#safety)

## How it works

Players predict whether the BTC price will move **up** or **down**.

A bet is anchored to the latest market price visible to the player. After the 60-second target time is reached, the first subsequent Coinbase price event whose price differs from the starting price resolves the bet. A correct prediction increases the player's score by one.

Only one bet per user can be active at a time.

The player record's optional `activeBetId` is the authoritative recovery pointer; the browser does not persist active-bet state. Each bet keeps the stable `(playerId, betId)` key from creation through resolution.

The frontend waits until the bet's earliest resolution timestamp before checking its status, and polls once per second only while the backend still reports the bet as active. This avoids roughly 60 unnecessary requests during the first minute of every bet.

## Architecture

```text
                         Coinbase WebSocket
                                  |
                                  v
                        ECS / Fargate Consumer
                                  |
                                  v
                           MarketPriceEvent
                                  |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
        Bet Resolver       History Sampler     Live Price Publisher
              |                   |                   |
              |                   |                   v
              |                   |              AppSync Events
              |                   |                   |
              +---------+---------+                   |
                        |                             | live prices
                        v                             v
                    +---------+              +-------------------+
                    | DynamoDB|              | React / Vite      |
                    +---------+              | frontend          |
                        ^                    +-------------------+
                        |                             |
                        |                             | REST API
                        |                             v
                        |                        API Gateway
                        |                             |
                        |                             v
                        +-------------------------- Lambda
                             history / bets /
                             scores / active-bet polling

```

The application uses:

- React/Vite frontend hosted on AWS Amplify
- Amazon Cognito for authentication
- API Gateway for the HTTP API
- AWS Lambda for request/response backend operations
- DynamoDB for application data and retained market history
- a long-running BTC price consumer on ECS/Fargate
- AppSync Events for live browser updates
- Terraform for long-lived AWS infrastructure

The default AWS region is eu-central-1. Use another region by setting aws_region in variables.tf and passing the same region to the bootstrap script.

Terraform owns the long-lived infrastructure. Price-consumer application releases have a separate lifecycle: the release script builds and pushes an immutable Git-SHA image, registers a new ECS task-definition revision, and updates the ECS service. Terraform intentionally does not own the currently selected application revision, so an unrelated infrastructure apply cannot roll the running consumer back.

## Repository

```text
frontend/               React/Vite application
backend/
  bets/                 Lambda handler for create/get/list bet operations
  create-player/        Player Lambda
  get-prices/           Price-history Lambda
  confirm-player-sign-up/
  price-consumer/       Long-running ECS/Fargate application
terraform/              AWS infrastructure
scripts/                Bootstrap and deployment scripts
```

## Prerequisites

Install locally:

- Terraform 1.15+
- AWS CLI v2 with `aws login` support
- Node.js 20+
- pnpm
- Docker, for price-consumer releases

## Local development setup

Install frontend dependencies:

```powershell
pnpm --dir frontend install
```

The frontend reads its runtime/build configuration through Vite environment variables. For local development, create `frontend/.env.local` with values for the deployed backend and AppSync resources (`.env.example` is provided)

Start the frontend:

```powershell
pnpm --dir frontend dev
```

Run the production build or tests locally with:

```powershell
pnpm --dir frontend build
pnpm --dir frontend test
```

The price consumer has its own package and is built/tested independently:

```powershell
pnpm --dir backend/price-consumer install
pnpm --dir backend/price-consumer build
pnpm --dir backend/price-consumer test
```

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

The boundary is a maximum permission set; it does not grant permissions by itself. The deployment user, its login configuration, the deployment policy, and the runtime boundary policy remain external bootstrap resources. Terraform does not create, import, update, or delete them.

The initial IAM setup must be performed once by an **AWS administrator**. If the deployment user and both bootstrap policies are already configured, skip to [Log in to AWS](#log-in-to-aws).

## 1. First-time IAM setup

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
node scripts/bootstrap-aws.mjs --iam-user <btc-game-developer> --region eu-central-1
```

The script verifies the active administrator identity, renders templates for the selected account and region, and creates or safely updates the `btc-game-runtime-boundary` and `btc-game-developer` customer-managed policies. It attaches only the deployment policy to the specified IAM user.

The script handles IAM's managed-policy version limit by deleting only the oldest non-default version when a version slot is required. Temporary rendered policy files are removed automatically. The options shown above are also the defaults, so `node scripts/bootstrap-aws.mjs` is equivalent.

After this bootstrap, normal Terraform additions using the supported `btc-game-*` DynamoDB, Lambda, IAM runtime-role, ECS/Fargate, ECR, logging, API Gateway, and Amplify scopes **do not require administrator intervention**. Adding a new AWS service or expanding the maximum permissions available to runtime workloads still requires an administrator to review and update the external boundary or deployment policy.

Existing deployments must rerun the bootstrap script once after adding the price-consumer infrastructure so Terraform can manage its dedicated outbound-only security group. This updates only the external deployment policy; the runtime boundary does not change.

</details>

## 2. Log in to AWS

Log in as the deployment user, e.g:

```powershell
aws login --profile btc-game-developer
```

Keep using this session for the deployment commands below.

## 3. Deploy

### 3.1 Infrastructure

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

### 3.2 Frontend

From the repository root:

```powershell
node scripts/deploy-frontend.mjs
```

The script builds the Vite application, reads the API, Cognito, market, AppSync, and Amplify configuration from Terraform outputs, and deploys the resulting artifact to Amplify.

If dependencies are already installed:

```powershell
node scripts/deploy-frontend.mjs --skip-install
```

### 3.3 Price consumer

The infrastructure deployment above creates the ECS/Fargate resources required by the price consumer, including the ECR repository, ECS cluster and service, networking, IAM roles, logs, and an initial bootstrap task definition.

The ECS service is initially created with `desired_count = 0`, so no container runs until the first real application image is deployed.

Terraform owns this long-lived infrastructure and the bootstrap task definition. It intentionally ignores later changes to the ECS service's selected task-definition revision and desired count. This allows application releases to be deployed independently without a later infrastructure apply rolling them back.

#### Deploy the price consumer

After `terraform apply` has completed successfully, commit the application changes and run from the repository root:

```powershell
node scripts/deploy-price-consumer.mjs
```

The script verifies that the repository is clean, builds the price-consumer container, tags it with the current Git commit SHA, and saves the release metadata. It does not deploy anything yet.

Review the release metadata, then deploy it:

```powershell
node scripts/deploy-price-consumer.mjs --apply
```

The script:

1. pushes the immutable Git-SHA image to ECR;
2. reads the ECS service's current task definition;
3. creates a new task-definition revision using the new image and current runtime configuration;
4. updates the ECS service to that revision and sets `desired_count` to `1`;
5. waits until the new task is running.

On the first deployment, the current task definition is the Terraform-created bootstrap definition. On later deployments, it is the previously deployed application revision. The same two commands are therefore used for the first deployment and every subsequent release.

## Updating the application

Infrastructure and application releases intentionally have different lifecycles.

For infrastructure or Lambda/backend changes currently managed by Terraform, review and apply a new plan:

```powershell
cd terraform
terraform plan -out deployment.tfplan
terraform apply deployment.tfplan
```

For frontend-only changes:

```powershell
node scripts/deploy-frontend.mjs --skip-install
```

For price-consumer changes, commit the changes and repeat the two-step price-consumer deployment above.

A natural production evolution would be to move the application-release steps into CI/CD while keeping Terraform responsible for long-lived infrastructure.

### Verify the deployment

Get the public frontend URL:

```powershell
cd terraform
terraform output frontend_url
```

Open the returned URL in a browser.

Create an account with an email, password, and username. The player is signed in immediately. Refreshing or reopening the browser restores the Cognito session. The account menu supports logout and permanent account deletion.

Verify the price consumer after deployment:

```powershell
aws ecs describe-services --cluster btc-game-application --services btc-game-price-consumer
aws logs tail /aws/ecs/btc-game-price-consumer --follow
aws dynamodb query --table-name btc-game-price-history --key-condition-expression "product = :product" --expression-attribute-values '{":product":{"S":"BTC-USD"}}' --no-scan-index-forward --limit 1
```

The ECS service should report one running task, logs should contain `coinbase_connected`, and the DynamoDB query should return a recent real Coinbase point.

## Testing

Run the backend Lambda characterization tests from the repository root:

```powershell
node --test backend/bets/*.test.mjs backend/create-player/*.test.mjs backend/get-prices/*.test.mjs backend/confirm-player-sign-up/*.test.mjs
```

Run the frontend and price-consumer suites independently:

```powershell
pnpm --dir frontend test
pnpm --dir backend/price-consumer test
```

Both TypeScript applications are also checked by their production builds:

```powershell
pnpm --dir frontend build
pnpm --dir backend/price-consumer build
```

## Safety

- Always review the Terraform plan before applying it.
- Generate a new plan after a partial or failed apply.
- Do not commit Terraform state, saved plans, AWS credentials, rendered IAM policies, environment secrets, or build artifacts.
