variable "environment" {
  type = string
}

variable "project_name" {
  type = string
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "tfstate_bucket" {
  type        = string
  description = "S3 bucket holding this project's Terraform remote state — the CI role needs read/write on its state key to run plan/apply."
}

variable "tfstate_key" {
  type    = string
  default = "edp/terraform.tfstate"
}
