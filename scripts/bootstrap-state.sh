#!/usr/bin/env bash
# scripts/bootstrap-state.sh
# Creates the S3 bucket for Terraform remote state. Locking is S3-native
# (use_lockfile in the backend config) -- no DynamoDB lock table needed.
# Run ONCE per AWS account/environment before the first `terraform init`.
# Same pattern as marcelo-goncalves-blog/scripts/bootstrap-state.sh.
#
# Usage:
#   ENV=dev AWS_PROFILE=claude-dev bash scripts/bootstrap-state.sh

set -euo pipefail

ENV="${ENV:-dev}"
PROJECT="event-discovery-platform"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
BUCKET="${PROJECT}-${ENV}-tfstate"

echo "==> Bootstrapping Terraform remote state for ENV=${ENV}"
echo "    Bucket : ${BUCKET}"
echo "    Region : ${REGION}"
echo ""

if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "    [skip] S3 bucket already exists"
else
  echo "==> Creating S3 bucket..."
  if [ "${REGION}" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}"
  else
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi

  aws s3api put-bucket-versioning \
    --bucket "${BUCKET}" \
    --versioning-configuration Status=Enabled

  aws s3api put-bucket-encryption \
    --bucket "${BUCKET}" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"},
        "BucketKeyEnabled": true
      }]
    }'

  aws s3api put-public-access-block \
    --bucket "${BUCKET}" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  echo "    [ok] S3 bucket created and secured"
fi

echo ""
echo "==> Bootstrap complete. Next steps:"
echo "    1. Copy infrastructure/terraform/backend.hcl.example to backend.hcl"
echo "    2. Set bucket = \"${BUCKET}\" in backend.hcl"
echo "    3. Run: terraform init -backend-config=backend.hcl -var-file=env/${ENV}.tfvars"
