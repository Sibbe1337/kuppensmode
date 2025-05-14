resource "google_cloudfunctions2_function" "function" {
  project  = var.project_id
  name     = var.function_name
  location = var.region
  description = var.function_description

  build_config {
    runtime     = var.runtime
    entry_point = var.entry_point
    source {
      storage_source {
        bucket = var.source_archive_bucket
        object = var.source_archive_object
      }
    }
  }

  service_config {
    max_instance_count = var.max_instances
    min_instance_count = var.min_instances
    available_memory   = var.available_memory
    timeout_seconds    = var.timeout_seconds
    service_account_email = var.service_account_email
    environment_variables = var.environment_variables

    dynamic "secret_environment_variables" {
      for_each = var.secret_environment_variables
      content {
        key        = secret_environment_variables.value.key
        project_id = secret_environment_variables.value.project_id
        secret     = secret_environment_variables.value.secret_id
        version    = secret_environment_variables.value.version
      }
    }
    
    # dynamic "secret_volumes" { # REMOVING/COMMENTING OUT this block
    #   for_each = var.secret_environment_variables 
    #   content {
    #     mount_path = "/secrets/${secret_volumes.value.secret_id}" 
    #     project_id = secret_volumes.value.project_id
    #     secret     = secret_volumes.value.secret_id
    #     versions {
    #       version = secret_volumes.value.version
    #       path    = "secret" 
    #     }
    #   }
    # }

    ingress_settings               = var.trigger_type == "HTTP" ? "ALLOW_ALL" : "ALLOW_INTERNAL_ONLY" 
    all_traffic_on_latest_revision = true
  }

  dynamic "event_trigger" {
    for_each = var.trigger_type == "PUBSUB" ? [1] : []
    content {
      trigger_region = var.region 
      event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
      pubsub_topic   = "projects/${var.project_id}/topics/${var.pubsub_trigger_topic_id}"
      retry_policy   = "RETRY_POLICY_RETRY" 
    }
  }

  labels = var.labels
}

# IAM binding for HTTP functions to allow unauthenticated (public) invocation if specified
# Or invoker for specific service accounts for internal HTTP functions
resource "google_cloudfunctions2_function_iam_member" "invoker" {
  count = var.trigger_type == "HTTP" && var.http_trigger_security_level == "ALLOW_UNAUTHENTICATED" ? 1 : 0

  project        = google_cloudfunctions2_function.function.project
  location       = google_cloudfunctions2_function.function.location
  cloud_function = google_cloudfunctions2_function.function.name

  role   = "roles/run.invoker"
  member = "allUsers"
}

# Add other IAM members if needed, e.g., for specific service accounts to invoke HTTP functions
# resource "google_cloudfunctions2_function_iam_member" "service_account_invoker" {
#   count = var.trigger_type == "HTTP" && var.http_trigger_invoker_sa_email != "" ? 1 : 0
# 
#   project        = google_cloudfunctions2_function.function.project
#   location       = google_cloudfunctions2_function.function.location
#   cloud_function = google_cloudfunctions2_function.function.name
# 
#   role   = "roles/run.invoker"
#   member = "serviceAccount:${var.http_trigger_invoker_sa_email}"
# } 