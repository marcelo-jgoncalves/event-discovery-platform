terraform {
  # Matches the constraint used by marcelo-goncalves-blog/infra — keep the
  # two projects on the same Terraform major series until there is a reason
  # to diverge.
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state via S3, with S3-native locking (use_lockfile) -- no
  # DynamoDB lock table, same pattern as marcelo-goncalves-blog/infra.
  # Backend is configured at runtime: CI passes -backend-config flags,
  # local dev uses infrastructure/terraform/backend.hcl (gitignored).
  # Bootstrap: run scripts/bootstrap-state.sh once per AWS account/env.
  backend "s3" {
    # Values injected at `terraform init` via -backend-config or backend.hcl:
    #   bucket       = "event-discovery-platform-<env>-tfstate"
    #   key          = "edp/terraform.tfstate"
    #   region       = "us-east-1"
    #   use_lockfile = true
    #   encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  # Local dev: set AWS_PROFILE=claude-dev or configure via ~/.aws/credentials.
  # CI: credentials injected via OIDC (no static keys) — see
  # modules/iam-github-oidc.

  default_tags {
    tags = {
      Project     = local.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "architecture"
    }
  }
}
