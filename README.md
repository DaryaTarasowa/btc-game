# BTC game

Small serverless application deployed to AWS in `eu-central-1`.

## Architecture

- React/Vite frontend hosted on Amplify
- `POST /players` through API Gateway
- Node.js Lambda that creates players in DynamoDB
- Terraform-managed application infrastructure

## Repository

```text
frontend/              React/Vite app
backend/create-player/ Lambda source
terraform/             AWS infrastructure
scripts/               Frontend deployment
```

See [terraform/README.md](terraform/README.md) for infrastructure and frontend deployment.
