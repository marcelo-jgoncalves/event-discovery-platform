output "role_arn" {
  value = aws_iam_role.this.arn
}

output "role_name" {
  value = aws_iam_role.this.name
}

output "deploy_role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "ADR-014 — set as the AWS_ROLE_ARN_CD_DEV GitHub Actions secret. Only cd.yml assumes this."
}
