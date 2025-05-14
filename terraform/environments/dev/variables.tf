variable "gcp_project_id" {
  description = "GCP Project ID for the Development environment."
  type        = string
  // No default - this must be set for the dev environment, typically in terraform.tfvars or as an environment variable.
}

variable "gcp_region" {
  description = "GCP Region for the Development environment."
  type        = string
  // Default can be inherited from root variables.tf if not specified here or in tfvars
  // Or set a dev-specific default if needed: e.g., default = "us-west1"
}

variable "app_name_prefix" {
  description = "Prefix for dev environment resources."
  type        = string
  default     = "nl" // Inherits from root, can be overridden in terraform.tfvars if needed e.g. "nl-dev"
}

variable "common_tags" {
  description = "Common tags for the dev environment, merging with or overriding root tags."
  type        = map(string)
  default     = {} // Start with empty map, specific dev tags can be added in terraform.tfvars or here
                  // Or inherit from root and merge: default = { environment = "development" }
}

variable "gcp_project_number" {
  description = "The GCP project number (not ID) for the Development environment."
  type        = string
  // This will be supplied via the terraform.tfvars file for the dev environment.
} 