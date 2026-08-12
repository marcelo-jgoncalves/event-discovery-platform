output "cicd_role_arn" {
  value       = module.iam-github-oidc.role_arn
  description = "Set as the AWS_ROLE_ARN_{ENV} GitHub Actions secret for this environment."
}

output "identity_user_pool_id" {
  value = module.identity.user_pool_id
}

output "identity_users_table_name" {
  value = module.identity.users_table_name
}
