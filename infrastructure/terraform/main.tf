module "iam-github-oidc" {
  source = "./modules/iam-github-oidc"

  environment    = var.environment
  github_org     = var.github_org
  github_repo    = var.github_repo
  tfstate_bucket = "${local.project_name}-${var.environment}-tfstate"
}

# Phase 1 — Identity (spec-identity.md, ADR-012): Cognito User Pool/Client +
# UsersTable. First real product infrastructure in this repo (everything
# before this module was CI/CD foundation only).
module "identity" {
  source = "./modules/identity"

  environment = var.environment
}

# Phase 2 — Catalog (spec-catalog.md, ADR-013): CatalogTable + shared
# ingestion SQS queue for the TMDB/Ticketmaster connectors.
module "catalog" {
  source = "./modules/catalog"

  environment = var.environment
}
