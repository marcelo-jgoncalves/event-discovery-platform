# Catalog component (spec-catalog.md, ADR-013): CatalogTable (Work/Event
# items, no GSI — title lookup and the UNRESOLVED review queue are companion
# items on the same table) plus the shared ingestion SQS queue that both
# TMDB and Ticketmaster connectors feed.

locals {
  name_prefix = "edp-${var.environment}-${var.component}"
}

# ---------------------------------------------------------------------------
# CatalogTable — spec-catalog.md §5. PK/SK only: Work/Event metadata items,
# WORKTITLE#* title-lookup items, REVIEW#UNRESOLVED review-queue items all
# share the same primary key shape (ADR-013 §2-3).
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "catalog" {
  name         = "Edp${title(var.environment)}CatalogTable"
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
# Ingestion SQS — spec-catalog.md §4. One shared queue for both providers;
# the message carries a serialized RawSourceEvent, normalizer dispatches on
# its `source` field. DLQ mandatory (quality-strategy.md general convention).
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${local.name_prefix}-ingestion-dlq"
  message_retention_seconds = 1209600 # 14 days — max SQS allows, gives time to investigate
  sqs_managed_sse_enabled   = true

  tags = {
    Component = var.component
  }
}

resource "aws_sqs_queue" "ingestion" {
  name                       = "${local.name_prefix}-ingestion"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 days
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingestion_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Component = var.component
  }
}

# ---------------------------------------------------------------------------
# Least-privilege IAM role for services/catalog (resource-naming.md §8).
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "catalog_service_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "catalog_service" {
  name               = "edp-${var.environment}-role-catalog-service"
  assume_role_policy = data.aws_iam_policy_document.catalog_service_trust.json
}

data "aws_iam_policy_document" "catalog_service" {
  statement {
    sid    = "CatalogTableReadWrite"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.catalog.arn]
  }

  statement {
    sid    = "IngestionQueueConsume"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.ingestion.arn]
  }
}

resource "aws_iam_policy" "catalog_service" {
  name   = "edp-${var.environment}-policy-catalog-service"
  policy = data.aws_iam_policy_document.catalog_service.json
}

resource "aws_iam_role_policy_attachment" "catalog_service" {
  role       = aws_iam_role.catalog_service.name
  policy_arn = aws_iam_policy.catalog_service.arn
}
