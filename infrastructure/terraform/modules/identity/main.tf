# Identity component (spec-identity.md, ADR-012): Cognito User Pool as the
# sole system of record for user PII, plus UsersTable for the non-PII
# profile/consent projections. See ADR-012 for why Cognito (vs custom auth /
# third-party IdP) and why UsersTable never duplicates raw PII.

locals {
  name_prefix = "edp-${var.environment}-${var.component}"
}

# ---------------------------------------------------------------------------
# Cognito User Pool — spec-identity.md §3.2. Email-as-username, direct API
# only (no Hosted UI — no web frontend exists yet to redirect to).
# ---------------------------------------------------------------------------
resource "aws_cognito_user_pool" "this" {
  name = "${local.name_prefix}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  # OPTIONAL: end users may opt into TOTP MFA. Mandatory admin MFA is
  # explicitly deferred (ADR-012, owner + review deadline recorded there and
  # in docs/backlog.md) — not implemented here as an oversight.
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Only "prod" gets deletion protection — dev must stay disposable for
  # iteration (destroying/recreating the pool during Phase 1 development is
  # expected, prod never should be).
  deletion_protection = var.environment == "prod" ? "ACTIVE" : "INACTIVE"

  tags = {
    Component = var.component
  }
}

# ---------------------------------------------------------------------------
# App Client — confidential client (secret required). Every caller is
# services/identity running server-side; no browser/mobile client exists yet
# to justify a public client (spec-identity.md §3.3).
# ---------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "this" {
  name         = "${local.name_prefix}-app-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = true

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

# App client secret is a Cognito-managed value, not a Terraform variable —
# store it in Secrets Manager so services/identity reads it at runtime
# instead of it ever landing in a plaintext tfvars/env var
# (quality-strategy.md §4.2).
resource "aws_secretsmanager_secret" "app_client_secret" {
  name = "${local.name_prefix}-app-client-secret"

  tags = {
    Component = var.component
  }
}

resource "aws_secretsmanager_secret_version" "app_client_secret" {
  secret_id = aws_secretsmanager_secret.app_client_secret.id
  secret_string = jsonencode({
    userPoolId   = aws_cognito_user_pool.this.id
    clientId     = aws_cognito_user_pool_client.this.id
    clientSecret = aws_cognito_user_pool_client.this.client_secret
  })
}

# ---------------------------------------------------------------------------
# UsersTable — spec-identity.md §4. PK/SK only, no GSI: every access pattern
# known today (get profile, get one consent, get all consents for a user) is
# served by the primary key.
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "users" {
  name         = "Edp${title(var.environment)}UsersTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Component = var.component
  }
}

# ---------------------------------------------------------------------------
# Least-privilege IAM role for services/identity (resource-naming.md §8) —
# scoped to exactly this table and this pool, never a shared/generic Lambda
# role (quality-strategy.md §4.2).
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "identity_service_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "identity_service" {
  name               = "edp-${var.environment}-role-identity-service"
  assume_role_policy = data.aws_iam_policy_document.identity_service_trust.json
}

data "aws_iam_policy_document" "identity_service" {
  statement {
    sid    = "UsersTableReadWrite"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.users.arn]
  }

  statement {
    sid    = "CognitoUserManagement"
    effect = "Allow"
    actions = [
      "cognito-idp:SignUp",
      "cognito-idp:InitiateAuth",
      "cognito-idp:ConfirmSignUp",
      "cognito-idp:ForgotPassword",
      "cognito-idp:ConfirmForgotPassword",
    ]
    resources = [aws_cognito_user_pool.this.arn]
  }

  statement {
    sid       = "AppClientSecretRead"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app_client_secret.arn]
  }
}

resource "aws_iam_policy" "identity_service" {
  name   = "edp-${var.environment}-policy-identity-service"
  policy = data.aws_iam_policy_document.identity_service.json
}

resource "aws_iam_role_policy_attachment" "identity_service" {
  role       = aws_iam_role.identity_service.name
  policy_arn = aws_iam_policy.identity_service.arn
}
