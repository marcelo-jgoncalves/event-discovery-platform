variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type        = string
  description = "dev | prod (docs/engineering/standards/resource-naming.md §2)"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be \"dev\" or \"prod\"."
  }
}

variable "github_org" {
  type        = string
  description = "GitHub org/user that owns the repository allowed to assume the CI role."
}

variable "github_repo" {
  type        = string
  description = "Repository name allowed to assume the CI role via OIDC."
  default     = "event-discovery-platform"
}

locals {
  # Single source of truth for the Project tag value — resource-naming.md §12
  # calls out a hardcoded string per module/tfvars as the exact cause of a
  # past tag-drift incident (marcelo-goncalves-blog history).
  project_name = "event-discovery-platform"
}
