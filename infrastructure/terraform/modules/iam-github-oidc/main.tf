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
}

resource "aws_iam_policy" "ci" {
  name   = "edp-${var.environment}-policy-cicd-github-actions"
  policy = data.aws_iam_policy_document.ci.json
}

resource "aws_iam_role_policy_attachment" "ci" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.ci.arn
}
