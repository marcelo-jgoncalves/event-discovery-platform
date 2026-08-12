output "catalog_table_name" {
  value = aws_dynamodb_table.catalog.name
}

output "ingestion_queue_url" {
  value = aws_sqs_queue.ingestion.url
}

output "ingestion_queue_arn" {
  value = aws_sqs_queue.ingestion.arn
}

output "ingestion_dlq_arn" {
  value = aws_sqs_queue.ingestion_dlq.arn
}

output "catalog_service_role_arn" {
  value = aws_iam_role.catalog_service.arn
}
