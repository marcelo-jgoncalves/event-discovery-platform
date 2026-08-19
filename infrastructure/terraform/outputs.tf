output "cicd_role_arn" {
  value       = module.iam-github-oidc.role_arn
  description = "Set as the AWS_ROLE_ARN_{ENV} GitHub Actions secret for this environment."
}

output "cd_deploy_role_arn" {
  value       = module.iam-github-oidc.deploy_role_arn
  description = "ADR-014 — set as the AWS_ROLE_ARN_CD_DEV GitHub Actions secret. Only cd.yml assumes this."
}

output "identity_user_pool_id" {
  value = module.identity.user_pool_id
}

output "identity_users_table_name" {
  value = module.identity.users_table_name
}

output "catalog_table_name" {
  value = module.catalog.catalog_table_name
}

output "catalog_ingestion_queue_url" {
  value = module.catalog.ingestion_queue_url
}
