# Reuses the account's existing GitHub OIDC provider (created once via
# marcelo-goncalves-blog-arquivo/docs-historico/oidc.yaml.txt, reused here —
# it's an account-level singleton, not a per-project resource). This module
# never creates the provider, only reads it.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Trust policy restricted to this repo, any ref (StringLike wildcard on the
# ref segment) — Tier A checks run on `pull_request` (sub is
# `repo:{org}/{repo}:pull_request`) as well as `push` to main (sub is
# `repo:{org}/{repo}:ref:refs/heads/main`); scoping by repo instead of a
# single fixed ref is what makes PR-triggered plan/lint jobs work at all.
# No fork exception is needed since the condition already pins the repo.
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
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:*"]
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
