# main.tf - Root Terraform configuration (Provider and general settings)

terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0" # Specify a version constraint, check latest
    }
    // Add other providers if needed (e.g., Vercel, Cloudflare)
  }
}

provider "google" {
  // Project and Region can be set here, or via environment variables, 
  // or in environment-specific .tfvars files.
  // It's common to set them in environment-specific configurations.
  // project = var.gcp_project_id 
  // region  = var.gcp_region
  // zone    = var.gcp_zone

  // For authentication, Terraform will attempt to use, in order:
  // 1. Credentials from the `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to service account key JSON).
  // 2. Application Default Credentials (ADC) - e.g., from `gcloud auth application-default login` or service account on GCP compute instances.
  // 3. If running in Cloud Shell, credentials are automatically available.
}

// Example variables (can be defined in variables.tf and overridden in .tfvars)
// variable "gcp_project_id" {
//   description = "The GCP project ID to deploy resources into."
//   type        = string
// }

// variable "gcp_region" {
//   description = "The GCP region for resources."
//   type        = string
//   default     = "us-central1" // Or your preferred default
// }

// variable "gcp_zone" {
//   description = "The GCP zone for zonal resources."
//   type        = string
//   default     = "us-central1-a" // Or your preferred default
// }

// We will create environment-specific configurations later (e.g., terraform/environments/dev/main.tf)
// that will use these providers and potentially call modules.

output "info" {
  value = "Root Terraform configuration. Define resources in modules or environment-specific files."
} 