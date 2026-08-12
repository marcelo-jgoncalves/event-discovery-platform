output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "app_client_id" {
  value = aws_cognito_user_pool_client.this.id
}

output "app_client_secret_arn" {
  value       = aws_secretsmanager_secret.app_client_secret.arn
  description = "services/identity reads the client secret from here at runtime — never from a Terraform variable."
}

output "users_table_name" {
  value = aws_dynamodb_table.users.name
}

output "identity_service_role_arn" {
  value = aws_iam_role.identity_service.arn
}
