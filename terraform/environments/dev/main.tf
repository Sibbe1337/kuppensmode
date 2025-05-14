terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Backend configuration is inherited from the root terraform/backend.tf
  # It will use the prefix specified there (e.g., "terraform/state") and then 
  # the relative path from the root to this file will form part of the state name,
  # or you can define specific backend configs per environment if needed.
  # For GCS backend, it often creates a environments/dev/default.tfstate object in the bucket.
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

module "pubsub_snapshot_requests_dev" {
  source     = "../../modules/pubsub_topic" # Relative path to the module

  project_id = var.gcp_project_id
  topic_name = "${var.app_name_prefix}-dev-snapshot-requests"
  labels     = merge(
    var.common_tags,
    {
      environment = "development"
      service     = "snapshot-trigger"
    }
  )
  # message_storage_policy can be set here if needed for this specific topic
}

module "pubsub_restore_requests_dev" {
  source     = "../../modules/pubsub_topic"

  project_id = var.gcp_project_id
  topic_name = "${var.app_name_prefix}-dev-restore-requests"
  labels     = merge(
    var.common_tags,
    {
      environment = "development"
      service     = "restore-trigger"
    }
  )
}

output "dev_snapshot_topic_name" {
  description = "Name of the Pub/Sub topic for dev snapshot requests."
  value       = module.pubsub_snapshot_requests_dev.topic_name_short
}

output "dev_restore_topic_name" {
  description = "Name of the Pub/Sub topic for dev restore requests."
  value       = module.pubsub_restore_requests_dev.topic_name_short
}

# To add the third topic for scheduled snapshots:
# module "pubsub_schedule_snapshot_dev" {
#   source     = "../../modules/pubsub_topic"
# 
#   project_id = var.gcp_project_id
#   topic_name = "${var.app_name_prefix}-dev-schedule-snapshot-requests" // Or your desired name for dev
#   labels     = merge(
#     var.common_tags,
#     {
#       environment = "development"
#       service     = "scheduler-trigger"
#     }
#   )
# }
# 
# output "dev_schedule_snapshot_topic_name" {
#   description = "Name of the Pub/Sub topic for dev scheduled snapshot requests."
#   value       = module.pubsub_schedule_snapshot_dev.topic_name_short
# }

# GCS Bucket for storing dev environment snapshots
resource "google_storage_bucket" "dev_snapshots_bucket" {
  name                        = "nl-dev-snapshots-youruniqueid" # Make sure this is the exact name
  location                    = "EU"                          # Corrected to EU (multi-region) to match imported state and screenshot
  uniform_bucket_level_access = true
  storage_class               = "STANDARD"

  versioning {
    enabled = true 
  }

  soft_delete_policy {
    retention_duration_seconds = 604800 # 7 days in seconds
  }

  labels = merge(
    var.common_tags,
    {
      environment = "development"
      service     = "snapshot-storage"
    }
  )
}

output "dev_snapshots_bucket_name" {
  description = "Name of the GCS bucket for dev snapshots."
  value       = google_storage_bucket.dev_snapshots_bucket.name
}

# --- Secret Manager Secrets ---

locals {
  secret_common_labels = merge(
    var.common_tags,
    {
      environment = "development"
      # You can add a common 'category = "secret"' label here if desired
    }
  )
  secrets_location = var.gcp_region # Assuming secrets are regional, in the same region as other resources
}

resource "google_secret_manager_secret" "notion_api_key_dev" {
  project   = var.gcp_project_id
  secret_id = "notion-api-key-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "notion-integration" })
}

resource "google_secret_manager_secret" "clerk_secret_key_dev" {
  project   = var.gcp_project_id
  secret_id = "clerk-secret-key-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "clerk" })
}

resource "google_secret_manager_secret" "stripe_secret_key_dev" {
  project   = var.gcp_project_id
  secret_id = "stripe-secret-key-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "stripe" })
}

resource "google_secret_manager_secret" "stripe_webhook_secret_dev" {
  project   = var.gcp_project_id
  secret_id = "stripe-webhook-secret-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "stripe-webhook" })
}

resource "google_secret_manager_secret" "pinecone_api_key_dev" {
  project   = var.gcp_project_id
  secret_id = "pinecone-api-key-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "pinecone" })
}

resource "google_secret_manager_secret" "openai_api_key_dev" {
  project   = var.gcp_project_id
  secret_id = "openai-api-key-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "openai" })
}

resource "google_secret_manager_secret" "gcp_service_account_key_json_dev" {
  project   = var.gcp_project_id
  secret_id = "gcp-service-account-key-json-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "gcp-auth" })
}

resource "google_secret_manager_secret" "pinecone_index_name_dev" {
  project   = var.gcp_project_id
  secret_id = "pinecone-index-name-dev"
  replication {
    user_managed {
      replicas {
        location = local.secrets_location
      }
    }
  }
  labels = merge(local.secret_common_labels, { service = "pinecone-config" })
}

// --- Outputs for Secret IDs (optional, but can be useful) ---
output "notion_api_key_dev_secret_id" {
  value = google_secret_manager_secret.notion_api_key_dev.secret_id
}
output "clerk_secret_key_dev_secret_id" {
  value = google_secret_manager_secret.clerk_secret_key_dev.secret_id
}
// Add other outputs as needed...

// --- IAM Service Account for Application Workers ---
resource "google_service_account" "worker_sa" {
  project      = var.gcp_project_id
  account_id   = "notion-lifeline-worker-sa"
  display_name = "Notion Lifeline App Worker Service Account"
  description  = "Service account for Notion Lifeline backend workers (snapshot, restore, etc.) in dev."
}

output "worker_sa_email" {
  description = "The email address of the worker service account."
  value       = google_service_account.worker_sa.email
}

output "worker_sa_name" {
  description = "The full name of the worker service account."
  value       = google_service_account.worker_sa.name // projects/{project}/serviceAccounts/{email}
}

// --- Secret IAM Bindings ---

resource "google_secret_manager_secret_iam_member" "notion_api_key_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.notion_api_key_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "clerk_secret_key_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.clerk_secret_key_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "stripe_secret_key_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.stripe_secret_key_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "stripe_webhook_secret_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.stripe_webhook_secret_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "pinecone_api_key_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.pinecone_api_key_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "openai_api_key_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.openai_api_key_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "gcp_service_account_key_json_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.gcp_service_account_key_json_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "pinecone_index_name_dev_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.pinecone_index_name_dev.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker_sa.email}"
}

// End of Secret IAM Bindings 

# GCS Bucket for storing Cloud Function source archives for the dev environment
resource "google_storage_bucket" "dev_cloudfunctions_source_bucket" {
  name                        = "nl-dev-cloudfunctions-source-a1b2c3d4" # Exact name from screenshot
  project                     = var.gcp_project_id
  location                    = "US"  # Multi-region US, as per screenshot
  uniform_bucket_level_access = true
  storage_class               = "STANDARD"
  
  versioning {
    enabled = true # Assuming versioning is enabled, like your snapshots bucket
  }

  soft_delete_policy {
    retention_duration_seconds = 604800 # 7 days in seconds (GCP default for soft delete)
  }

  labels = merge(
    var.common_tags,
    {
      environment = "development"
      service     = "cloudfunctions-source-storage"
    }
  )
}

output "dev_cloudfunctions_source_bucket_name" {
  description = "Name of the GCS bucket for dev Cloud Function source code."
  value       = google_storage_bucket.dev_cloudfunctions_source_bucket.name
}

# --- Cloud Functions Gen2 ---

module "dev_snapshot_worker" {
  source = "../../modules/cloud_function_gen2"

  project_id             = var.gcp_project_id
  region                 = var.gcp_region # Should be "europe-west1" from your tfvars or gcloud command
  function_name          = "dev-snapshot-worker" # Exact name of the deployed function
  function_description   = "Dev environment: Worker to take snapshots of Notion workspaces."
  
  runtime                = "nodejs20"
  entry_point            = "snapshotTrigger"
  
  # Source code information from the gcloud deployment output
  source_archive_bucket  = "gcf-v2-sources-343417106506-europe-west1" # Bucket created by gcloud deploy
  source_archive_object  = "dev-snapshot-worker/function-source.zip"   # Object created by gcloud deploy

  service_account_email  = google_service_account.worker_sa.email
  available_memory       = "512Mi"
  timeout_seconds        = 300

  trigger_type           = "PUBSUB"
  # The pubsub_trigger_topic_id needs to be the short name of the topic.
  # module.pubsub_snapshot_requests_dev.topic_name_short should provide "nl-dev-snapshot-requests"
  pubsub_trigger_topic_id = module.pubsub_snapshot_requests_dev.topic_name_short

  environment_variables = {
    GCP_PROJECT_ID    = var.gcp_project_id
    GCS_BUCKET_NAME   = google_storage_bucket.dev_snapshots_bucket.name 
    NODE_ENV          = "development"
    // LOG_EXECUTION_ID is often added by GCP automatically, can be omitted here if so
  }

  secret_environment_variables = [
    {
      key        = "NOTION_API_KEY"
      project_id = var.gcp_project_id 
      secret_id  = google_secret_manager_secret.notion_api_key_dev.secret_id
      version    = "1" # Using specific version as per successful gcloud deploy
    },
    {
      key        = "PINECONE_API_KEY"
      project_id = var.gcp_project_id
      secret_id  = google_secret_manager_secret.pinecone_api_key_dev.secret_id
      version    = "1"
    },
    {
      key        = "PINECONE_INDEX_NAME" 
      project_id = var.gcp_project_id
      secret_id  = google_secret_manager_secret.pinecone_index_name_dev.secret_id
      version    = "1"
    },
    {
      key        = "OPENAI_API_KEY"
      project_id = var.gcp_project_id
      secret_id  = google_secret_manager_secret.openai_api_key_dev.secret_id
      version    = "1"
    }
  ]

  labels = merge(
    var.common_tags,
    {
      environment     = "development"
      service         = "snapshot-worker"
      trigger         = "pubsub"
      // "deployment-tool" = "cli-gcloud" was added by gcloud, Terraform will manage its own if needed or adopt.
      // For now, let Terraform set its standard labels based on common_tags and these specific ones.
    }
  )
  // http_trigger_security_level is not needed for Pub/Sub triggers
}

output "dev_snapshot_worker_function_name" {
  description = "Name of the dev snapshot worker Cloud Function."
  value       = module.dev_snapshot_worker.function_name
}

output "dev_snapshot_worker_uri" {
  description = "URI of the dev snapshot worker Cloud Function (if HTTP triggered, otherwise NA)."
  value       = module.dev_snapshot_worker.function_uri
}
output "dev_snapshot_worker_sa_email" {
  description = "Service account used by the snapshot worker."
  value       = module.dev_snapshot_worker.service_account_email
}

# Grant Pub/Sub service agent permission to invoke the Cloud Run service
# This is necessary because the function is triggered by Pub/Sub and ingress is internal-only.
resource "google_cloud_run_service_iam_member" "dev_snapshot_worker_invoker_pubsub" {
  project  = var.gcp_project_id
  location = var.gcp_region
  service  = module.dev_snapshot_worker.function_name # Use function_name as service name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.gcp_project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Grant Eventarc service agent permission to invoke the Cloud Run service
# Eventarc uses its own SA to manage the trigger and invoke the target.
resource "google_cloud_run_service_iam_member" "dev_snapshot_worker_invoker_eventarc" {
  project  = var.gcp_project_id
  location = var.gcp_region
  service  = module.dev_snapshot_worker.function_name # Use function_name as service name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.gcp_project_number}@gcp-sa-eventarc.iam.gserviceaccount.com"
}

# It's also good practice to ensure the function's own service account can invoke itself 
# if there are any self-invocation patterns (less common for Pub/Sub, but harmless).
resource "google_cloud_run_service_iam_member" "dev_snapshot_worker_invoker_self" {
  project  = var.gcp_project_id
  location = var.gcp_region
  service  = module.dev_snapshot_worker.function_name # Use function_name as service name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.worker_sa.email}"
} 