# BTC game

A real-time BTC price prediction game built with React and an event-driven AWS backend.

## How it works

Players predict whether the BTC price will move **up** or **down**.

A bet is anchored to the latest market price visible to the player. After the 60-second target time is reached, the first subsequent Coinbase price event whose price differs from the starting price resolves the bet. A correct prediction increases the player's score by one.

Only one bet can be active at a time.

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

The application is deployed to `eu-central-1`.

Terraform owns the long-lived infrastructure. Price-consumer application releases have a separate lifecycle: the release script builds and pushes an immutable Git-SHA image, registers a new ECS task-definition revision, and updates the ECS service. Terraform intentionally does not own the currently selected application revision, so an unrelated infrastructure apply cannot roll the running consumer back.

## User accounts

Amazon Cognito provides email/password registration, login, logout, and durable sessions. Registrations are automatically confirmed by a minimal pre-sign-up trigger.
The player record's optional `activeBetId` is the authoritative recovery pointer; the browser does not persist active-bet state. Each bet keeps the stable `(playerId, betId)` key from creation through resolution.

The frontend waits until the bet's earliest resolution timestamp before checking its status, and polls once per second only while the backend still reports the bet as active. This avoids roughly 60 unnecessary requests during the first minute of every bet.

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
- Node.js
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
node scripts/bootstrap-aws.mjs --iam-user <btc-game-developer> --region eu-central-1
```

The script verifies the active administrator identity, renders templates for the selected account and region, and creates or safely updates the `btc-game-runtime-boundary` and `btc-game-developer` customer-managed policies. It attaches only the deployment policy to the specified IAM user.

The script handles IAM's managed-policy version limit by deleting only the oldest non-default version when a version slot is required. Temporary rendered policy files are removed automatically. The options shown above are also the defaults, so `node scripts/bootstrap-aws.mjs` is equivalent.

After this bootstrap, normal Terraform additions using the supported `btc-game-*` DynamoDB, Lambda, IAM runtime-role, ECS/Fargate, ECR, logging, API Gateway, and Amplify scopes **do not require administrator intervention**. Adding a new AWS service or expanding the maximum permissions available to runtime workloads still requires an administrator to review and update the external boundary or deployment policy.

Existing deployments must rerun the bootstrap script once after adding the price-consumer infrastructure so Terraform can manage its dedicated outbound-only security group. This updates only the external deployment policy; the runtime boundary does not change.

</details>

## Log in to AWS

Log in as the deployment user:

```powershell
aws login --profile btc-game-developer
```
Keep using this session for the deployment commands below.

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

The script builds the Vite application, reads the API, Cognito, market, AppSync, and Amplify configuration from Terraform outputs, and deploys the resulting artifact to Amplify.

If dependencies are already installed:

```powershell
node scripts/deploy-frontend.mjs --skip-install
```

### Price consumer

Terraform owns the ECS cluster, service shell, networking, IAM, logs, and ECR repository. Application releases own task definitions, the immutable revision selected by the service, and its operational desired count.

Terraform intentionally ignores the latter two service attributes, so an infrastructure apply cannot roll back a release or stop the consumer.

#### First deployment in a new environment

The normal release script assumes that the ECS service already has a task definition. Bootstrap a new environment once:

1. Apply the reviewed Terraform foundation for ECR, the ECS cluster, roles, networking, and logs.
2. Build the consumer and push its first immutable Git-SHA image.

**Linux:**

```bash
repository=$(terraform -chdir=terraform output -raw price_consumer_ecr_repository_url)
sha=$(git rev-parse HEAD)
docker build --tag "btc-game-price-consumer:$sha" backend/price-consumer
aws ecr get-login-password | docker login --username AWS --password-stdin "${repository%%/*}"
docker tag "btc-game-price-consumer:$sha" "${repository}:$sha"
docker push "${repository}:$sha"
```

**Windows (PowerShell):**

```powershell
$repository = terraform -chdir=terraform output -raw price_consumer_ecr_repository_url
$sha = git rev-parse HEAD
docker build --tag "btc-game-price-consumer:$sha" backend/price-consumer
aws ecr get-login-password | docker login --username AWS --password-stdin ($repository.Split('/')[0])
docker tag "btc-game-price-consumer:$sha" "${repository}:$sha"
docker push "${repository}:$sha"
```

3. Create an initial ECS task-definition JSON using the Terraform-created execution role, task role, log group, and application configuration, then register it once.

**Linux:**

```bash
task_definition_arn=$(
  aws ecs register-task-definition \
    --cli-input-json file://initial-price-consumer-task-definition.json \
    --query taskDefinition.taskDefinitionArn \
    --output text \
    --no-cli-pager
)
```

**Windows (PowerShell):**

```powershell
$taskDefinitionArn = aws ecs register-task-definition `
  --cli-input-json file://initial-price-consumer-task-definition.json `
  --query taskDefinition.taskDefinitionArn `
  --output text `
  --no-cli-pager
```

4. Create the Terraform-owned ECS service using that one-time ARN.

**Linux:**

```bash
terraform -chdir=terraform apply -var="price_consumer_initial_task_definition_arn=${task_definition_arn}"
```

**Windows (PowerShell):**

```powershell
terraform -chdir=terraform apply -var "price_consumer_initial_task_definition_arn=$taskDefinitionArn"
```

After the service exists, omit the initial ARN variable. Normal Terraform plans ignore release-selected task-definition and desired-count changes.

#### Normal releases

Commit application changes and prepare an immutable Git-SHA release from the repository root:

```powershell
node scripts/deploy-price-consumer.mjs
```

This builds the container locally without changing infrastructure. Review the release metadata, then explicitly deploy it:

```powershell
node scripts/deploy-price-consumer.mjs --apply
```

The apply mode authenticates Docker using the current AWS CLI identity, pushes the immutable image, reads the service's current task definition, updates the consumer image and runtime configuration, and registers the resulting revision.

It then updates the ECS service to that revision with desired count one and reports success when the new PRIMARY task is running with nothing pending. Older zero-task deployments do not delay completion. It does not run Terraform, and no credentials are stored in the image or script.

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
