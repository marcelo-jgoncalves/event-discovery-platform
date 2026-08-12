output "cicd_role_arn" {
  value       = module.iam-github-oidc.role_arn
  description = "Set as the AWS_ROLE_ARN_{ENV} GitHub Actions secret for this environment."
}
