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
#
# ADR-015: this same role is used by both ci.yml (plan-only, every PR) and
# cd.yml (apply, push to main) — trust policy stays "any ref/event" for
# both. A tighter, workflow-scoped trust policy for the apply path was
# considered (ADR-014) and explicitly reverted in favor of a single role.
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

# Covers both what Tier A (quality-strategy.md §1.1) needs on every PR —
# typecheck/lint/unit/integration-fast/dependency review/npm audit/SAST/
# secret scan/`terraform validate`+`terraform plan` — and what cd.yml needs
# to actually `terraform apply` product resources on push to `main`
# (ADR-015: one role for both, superseding ADR-014's separate deploy role).
# Scoped to exactly the resource types/prefixes that modules/identity and
# modules/catalog create today; grows PR by PR as real Terraform is added,
# never ahead of the code that needs it (resource-naming.md §3, CLAUDE.md
# principles). The write actions below are exercised only when cd.yml runs
# `terraform apply` — ci.yml's own jobs never call apply, only plan — but
# because this role's trust policy allows any ref/event of this repo (see
# comment on `trust` above), the permission itself is not restricted to
# that workflow by IAM; it's restricted by what each workflow's steps
# actually invoke. Accepted trade-off, ADR-015.
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

  statement {
    sid       = "IamReadOidcProvider"
    effect    = "Allow"
    actions   = ["iam:GetOpenIDConnectProvider"]
    resources = [data.aws_iam_openid_connect_provider.github.arn]
  }

  # The `aws_iam_openid_connect_provider` data source resolves by URL, not
  # ARN — it lists providers first before it can GetOpenIDConnectProvider,
  # which is what this role's own `terraform plan` does to read this data
  # source. This action isn't resource-scopable (IAM ignores a Resource
  # other than "*" for List* calls), so it's granted at "*" — read-only, no
  # console/data exposure beyond the list of OIDC provider ARNs already
  # visible via `aws iam list-open-id-connect-providers`.
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

  # modules/identity + modules/catalog: Edp{Dev,Prod}UsersTable, Edp{Dev,Prod}CatalogTable.
  statement {
    sid    = "DynamoDbManage"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:ListTagsOfResource",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:UpdateTable",
      "dynamodb:UpdateContinuousBackups",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
    ]
    resources = ["arn:aws:dynamodb:*:*:table/Edp*"]
  }

  # modules/identity: one Cognito User Pool + App Client.
  statement {
    sid    = "CognitoManage"
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:ListTagsForResource",
      "cognito-idp:CreateUserPool",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:TagResource",
      "cognito-idp:UntagResource",
    ]
    resources = [
      "arn:aws:cognito-idp:*:*:userpool/*",
    ]
  }

  # modules/identity: app-client-secret (never the raw PII secret — Cognito
  # itself is the PII system of record, this is only clientId/clientSecret).
  statement {
    sid    = "SecretsManagerManage"
    effect = "Allow"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteSecret",
      "secretsmanager:UpdateSecret",
      "secretsmanager:PutSecretValue",
      "secretsmanager:GetSecretValue",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
    ]
    resources = ["arn:aws:secretsmanager:*:*:secret:edp-*"]
  }

  # modules/catalog: ingestion queue + its DLQ. Read-only version of this
  # never existed before catalog's SQS had no Terraform yet at CI-role
  # creation time (ADR-010) — added here alongside write, both needed now.
  statement {
    sid    = "SqsManage"
    effect = "Allow"
    actions = [
      "sqs:GetQueueAttributes",
      "sqs:ListQueueTags",
      "sqs:CreateQueue",
      "sqs:DeleteQueue",
      "sqs:SetQueueAttributes",
      "sqs:TagQueue",
      "sqs:UntagQueue",
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
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListRoleTags",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
    ]
    resources = ["arn:aws:iam::*:role/edp-*"]
  }

  statement {
    sid    = "IamServicePolicyManage"
    effect = "Allow"
    actions = [
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
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
