variable "environment" {
  type        = string
  description = "dev | prod (docs/engineering/standards/resource-naming.md §2)"
}

variable "component" {
  type        = string
  default     = "identity"
  description = "resource-naming.md §3 component segment — kept as a variable per the module convention (no env/component hardcoded inside a module), even though this module only ever serves the identity component today."
}
