# Reuses the account's existing GitHub OIDC provider (created once via
# marcelo-goncalves-blog-arquivo/docs-historico/oidc.yaml.txt, reused here —
# it's an account-level singleton, not a per-project resource). This module
# never creates the provider, only reads it.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Trust policy restricted to this repo, any ref/event.
#
# Originally matched only on `sub` via StringLike ("repo:{org}/{repo}:*"),
# which silently never matched: GitHub's actual `sub` claim embeds immutable
# numeric owner/repo IDs (observed via CloudTrail:
# "repo:org@<ownerId>/repo@<repoId>:pull_request"), not the plain "org/repo"
# string this project (and the reused blog pattern) assumed.
#
# AWS separately requires the trust policy to constrain `sub` or
# `job_workflow_ref` specifically — a condition on `repository` alone is
# rejected as "not scoped to all" (MalformedPolicyDocument on apply). So both
# conditions are kept: `repository` for a readable, name-based check, and
# `sub` with the ID segments wildcarded so it satisfies AWS's requirement
# without hardcoding the numeric IDs (which would break on repo transfer).
data "aws_iam_policy_document" "trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:repository"
      values   = ["${var.github_org}/${var.github_repo}"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Covers both the legacy plain "org/repo" sub format and the observed
      # immutable-ID format ("org@ownerId/repo@repoId") — whichever GitHub
      # actually issues for a given event/trigger, either matches.
      values = [
        "repo:${var.github_org}/${var.github_repo}:*",
        "repo:${var.github_org}@*/${var.github_repo}@*:*",
      ]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "edp-${var.environment}-role-cicd-github-actions"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

# Tier A of quality-strategy.md §1.1 only runs typecheck/lint/unit/
# integration-fast/dependency review/npm audit/SAST/secret scan/
# `terraform validate`+`terraform plan` — no `terraform apply` of product
# resources yet (docs/operations/phase-0-kickoff-prompt.md §5). The policy
# below is scoped to exactly what plan/validate need against the resources
# that exist today (this role + the remote state bucket); it grows PR by PR
# as real DynamoDB/SQS/Lambda/S3/API Gateway Terraform is added, never ahead
# of the code that needs it (resource-naming.md §3, CLAUDE.md principles).
data "aws_iam_policy_document" "ci" {
  # Remote state: read/write the state object + S3-native lock, nothing else
  # in the bucket.
  statement {
    sid    = "TerraformStateObject"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["arn:aws:s3:::${var.tfstate_bucket}/${var.tfstate_key}*"]
  }

  statement {
    sid       = "TerraformStateBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.tfstate_bucket}"]
  }

  # Read-only self-inspection so `terraform plan` can refresh this very role
  # without granting any write/mutate action on IAM.
  statement {
    sid    = "IamReadOnlyEdpScoped"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListRoleTags",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
    ]
    resources = [
      "arn:aws:iam::*:role/edp-*",
      "arn:aws:iam::*:policy/edp-*",
    ]
  }

  statement {
    sid       = "IamReadOidcProvider"
    effect    = "Allow"
    actions   = ["iam:GetOpenIDConnectProvider"]
    resources = [data.aws_iam_openid_connect_provider.github.arn]
  }

  # The `aws_iam_openid_connect_provider` data source resolves by URL, not
  # ARN — it lists providers first before it can GetOpenIDConnectProvider,
  # which is what CI's own `terraform plan` does to read this data source.
  # This action isn't resource-scopable (IAM ignores a Resource other than
  # "*" for List* calls), so it's granted at "*" — read-only, no console/data
  # exposure beyond the list of OIDC provider ARNs already visible via
  # `aws iam list-open-id-connect-providers`.
  statement {
    sid       = "IamListOidcProviders"
    effect    = "Allow"
    actions   = ["iam:ListOpenIDConnectProviders"]
    resources = ["*"]
  }

  statement {
    sid       = "StsIdentity"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }

  # Grows here, PR by PR, as real product Terraform lands (see comment
  # above the ci policy) — first addition: Phase 1 Identity module
  # (modules/identity), plan-only, no write/apply actions.
  statement {
    sid    = "PlanIdentityDynamoDb"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:ListTagsOfResource",
      "dynamodb:DescribeContinuousBackups",
    ]
    resources = ["arn:aws:dynamodb:*:*:table/Edp*"]
  }

  statement {
    sid    = "PlanIdentityCognito"
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:ListTagsForResource",
    ]
    resources = [
      "arn:aws:cognito-idp:*:*:userpool/*",
    ]
  }

  statement {
    sid    = "PlanIdentitySecretsManager"
    effect = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
    ]
    resources = ["arn:aws:secretsmanager:*:*:secret:edp-*"]
  }

  statement {
    sid    = "PlanIdentityIamRole"
    effect = "Allow"
    actions = [
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
    ]
    resources = ["arn:aws:iam::*:policy/edp-*"]
  }
}

resource "aws_iam_policy" "ci" {
  name   = "edp-${var.environment}-policy-cicd-github-actions"
  policy = data.aws_iam_policy_document.ci.json
}

resource "aws_iam_role_policy_attachment" "ci" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.ci.arn
}

# =============================================================================
# Deploy role (ADR-014) — separate from the CI role above on purpose. The CI
# role is plan-only and trusted for any ref/event (appropriate for a
# read-mostly role that runs on every PR). This role can create/update/
# delete real product resources, so its trust policy is narrower: only the
# `cd.yml` workflow, only from `main`. Never widen the CI role's trust
# policy to cover this instead of adding a second role — that was
# considered and rejected in ADR-014's "Alternativas consideradas".
# =============================================================================
data "aws_iam_policy_document" "deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:repository"
      values   = ["${var.github_org}/${var.github_repo}"]
    }

    # job_workflow_ref pins this trust to one workflow file on one ref —
    # unlike the CI role's `sub` condition (any ref/event), a write-capable
    # role gets the narrowest scoping GitHub's OIDC token actually offers.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:job_workflow_ref"
      values   = ["${var.github_org}/${var.github_repo}/.github/workflows/cd.yml@refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "edp-${var.environment}-role-cd-github-actions"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

# Write-capable, but only for the exact resource types+prefixes that
# modules/identity and modules/catalog actually create today — grows PR by
# PR alongside the Terraform that needs it, same discipline as the CI
# policy above (never grant ahead of the code, resource-naming.md §8).
data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "TerraformStateObject"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["arn:aws:s3:::${var.tfstate_bucket}/${var.tfstate_key}*"]
  }

  statement {
    sid       = "TerraformStateBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.tfstate_bucket}"]
  }

  statement {
    sid       = "StsIdentity"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }

  # modules/identity + modules/catalog: Edp{Dev,Prod}UsersTable, Edp{Dev,Prod}CatalogTable.
  statement {
    sid    = "DynamoDbManage"
    effect = "Allow"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:UpdateTable",
      "dynamodb:DescribeTable",
      "dynamodb:UpdateContinuousBackups",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
      "dynamodb:ListTagsOfResource",
    ]
    resources = ["arn:aws:dynamodb:*:*:table/Edp*"]
  }

  # modules/identity: one Cognito User Pool + App Client.
  statement {
    sid    = "CognitoManage"
    effect = "Allow"
    actions = [
      "cognito-idp:CreateUserPool",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:TagResource",
      "cognito-idp:UntagResource",
      "cognito-idp:ListTagsForResource",
    ]
    resources = ["arn:aws:cognito-idp:*:*:userpool/*"]
  }

  # modules/identity: app-client-secret (never the raw PII secret — Cognito
  # itself is the PII system of record, this is only clientId/clientSecret).
  statement {
    sid    = "SecretsManagerManage"
    effect = "Allow"
    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteSecret",
      "secretsmanager:UpdateSecret",
      "secretsmanager:PutSecretValue",
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
    ]
    resources = ["arn:aws:secretsmanager:*:*:secret:edp-*"]
  }

  # modules/catalog: ingestion queue + its DLQ.
  statement {
    sid    = "SqsManage"
    effect = "Allow"
    actions = [
      "sqs:CreateQueue",
      "sqs:DeleteQueue",
      "sqs:SetQueueAttributes",
      "sqs:GetQueueAttributes",
      "sqs:TagQueue",
      "sqs:UntagQueue",
      "sqs:ListQueueTags",
    ]
    resources = ["arn:aws:sqs:*:*:edp-*"]
  }

  # modules/identity + modules/catalog: identity_service / catalog_service
  # roles+policies. No iam:PassRole — nothing assumes these roles yet
  # (no Lambda/compute deployed), add it only when a real caller needs it.
  statement {
    sid    = "IamServiceRoleManage"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
    ]
    resources = ["arn:aws:iam::*:role/edp-*"]
  }

  statement {
    sid    = "IamServicePolicyManage"
    effect = "Allow"
    actions = [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
    ]
    resources = ["arn:aws:iam::*:policy/edp-*"]
  }
}

resource "aws_iam_policy" "deploy" {
  name   = "edp-${var.environment}-policy-cd-github-actions"
  policy = data.aws_iam_policy_document.deploy.json
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}
