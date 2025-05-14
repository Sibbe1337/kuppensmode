resource "google_pubsub_topic" "topic" {
  project = var.project_id
  name    = var.topic_name
  labels  = var.labels

  dynamic "message_storage_policy" {
    for_each = var.message_storage_policy != null ? [var.message_storage_policy] : []
    content {
      allowed_persistence_regions = message_storage_policy.value.allowed_persistence_regions
    }
  }
} 