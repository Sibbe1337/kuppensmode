variable "gcp_project_id" {
  description = "The GCP project ID to deploy resources into."
  type        = string
  // This should be provided via environment variable (TF_VAR_gcp_project_id)
  // or a .tfvars file for each environment. No default here.
}

variable "gcp_region" {
  description = "The primary GCP region for resources like Cloud Functions, Pub/Sub."
  type        = string
  default     = "us-central1" // Example: Change to your preferred default region
}

variable "app_name_prefix" {
  description = "A prefix for resource names to ensure uniqueness and group resources."
  type        = string
  default     = "nl" // Stands for Notion Lifeline
}

variable "common_tags" {
  description = "The common tags to apply to all resources."
  type        = map(string)
  default     = {}
}

variable "gcp_project_number" {
  description = "The GCP project number (not ID)."
  type        = string
  # No default, this should be set in .tfvars for each environment
} 