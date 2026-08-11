module "iam-github-oidc" {
  source = "./modules/iam-github-oidc"

  environment    = var.environment
  project_name   = local.project_name
  github_org     = var.github_org
  github_repo    = var.github_repo
  tfstate_bucket = "${local.project_name}-${var.environment}-tfstate"
}
