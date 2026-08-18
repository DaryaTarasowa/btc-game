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
  Infrastructure definitions and import workflow
```

## Architecture

- Amplify Hosting builds the public GitHub repository automatically from `main`.
- API Gateway exposes `POST /players`.
- `createPlayer` generates a UUID and writes the new player to DynamoDB.
- DynamoDB stores players and guesses using on-demand billing.
- Terraform manages application resources and application execution identities.
- Terraform does not manage developer IAM users, credentials, or deployment permissions.

## Safety

Terraform defaults `enable_new_infrastructure` to `false`. Existing manually created resources must be imported and reviewed before enabling API Gateway and Amplify creation. Do not apply plans containing unexpected replacements or deletions.

See `terraform/README.md` for the adoption and deployment workflow.
