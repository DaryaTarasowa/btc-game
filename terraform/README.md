# BTC game infrastructure

Terraform manages the DynamoDB tables, Lambda runtime role and function, HTTP API, and Amplify Hosting app. Amplify has no GitHub connection; the frontend is built locally and uploaded explicitly.

## Prerequisites

- Terraform 1.15+
- AWS CLI v2 with deployment credentials
- Node.js and pnpm for the frontend build
- An AWS identity with the permissions in [`bootstrap/btc-game-developer-policy.template.json`](bootstrap/btc-game-developer-policy.template.json)

Terraform does not manage the deployment identity. An administrator must render the policy template by replacing `AWS_PARTITION`, `AWS_REGION`, and `AWS_ACCOUNT_ID`, then create or update the external managed policy and attach it to the deployment identity.

## Deploy infrastructure

From `terraform/`:

```powershell
terraform init
terraform plan -out deployment.tfplan
terraform apply deployment.tfplan
```

Review the saved plan before applying it. The default region is `eu-central-1`; override `aws_region` only when needed.

Confirm that configuration and deployed state match:

```powershell
terraform plan
terraform output
```

## Deploy frontend

After Terraform has completed, run from the repository root:

```powershell
.\scripts\deploy-frontend.ps1
```

The script reads the API and Amplify IDs from Terraform outputs, sets `VITE_CREATE_PLAYER_URL`, builds `frontend/dist`, uploads a temporary ZIP to Amplify, and starts a manual deployment on `main`.

If dependencies are already installed:

```powershell
.\scripts\deploy-frontend.ps1 -SkipInstall
```

## Safety

- Do not commit state, plan files, credentials, rendered policies, or build artifacts.
- Treat the deployment policy as privileged: it can create, update, and delete the application resources.
- Use a fresh plan after any partial or failed apply.
