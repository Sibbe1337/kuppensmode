# backend.tf - Configures remote state storage in a GCS bucket
# IMPORTANT: You must create this GCS bucket manually first!
# Replace 'your-notion-lifeline-tfstate-bucket' with your actual globally unique bucket name.
terraform {
  backend "gcs" {
    bucket  = "restoresnapshots" # REPLACE THIS
    prefix  = "terraform/state"
  }
} 