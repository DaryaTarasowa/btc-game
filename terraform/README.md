# BTC game infrastructure

Terraform owns the application infrastructure in `eu-central-1`.

Lambda source lives outside this directory under `../backend/create-player`. The legacy `createUser` ZIP is retained under `import-artifacts` only until Terraform adopts and retires that manually created function.

## Safety model

- `enable_new_infrastructure` defaults to `false`.
- Existing DynamoDB, IAM, and Lambda resources are declared with import blocks.
- API Gateway and Amplify Hosting are created only after explicitly setting the gate to `true`.
- Never apply a plan containing replacement or deletion of an adopted resource without reviewing it.

## Adoption workflow

1. Run `terraform init`.
2. Run `terraform plan -out adoption.tfplan` with the default gate set to `false`.
3. Review every import and in-place change. Do not apply if a table, role, policy, or Lambda would be replaced or deleted.
4. Apply only the reviewed adoption plan.
5. Run a second plan and confirm the adopted state is stable.

## New infrastructure workflow

After adoption is clean, set `enable_new_infrastructure = true`, provide `github_repository_url`, plan again, and review the API Gateway and Amplify resources before applying.

Amplify is connected to the public GitHub repository and automatically builds the `main` branch. Terraform supplies `VITE_CREATE_USER_URL` as an Amplify environment variable, so Vite receives the API endpoint during the hosted build. No local artifact-deployment script is used.

For initial repository connection, set `TF_VAR_github_access_token` in the shell running Terraform. The token is used to create the GitHub webhook and read-only deploy key. Remove the Terraform argument and delete the setup token after the first successful connection.

## Player naming migration

`createPlayer` is the canonical player-creation function and `POST /players` targets it. The existing `createUser` Lambda and role remain declared only during adoption so Terraform can bring them under state safely. After adoption, remove those legacy resources in a separate reviewed destroy plan; do not delete them manually.
