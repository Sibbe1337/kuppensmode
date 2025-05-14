resource "google_cloud_scheduler_job" "job" {
  project      = var.project_id
  region       = var.location_id # Cloud Scheduler uses 'region' for location
  name         = var.job_name
  description  = var.job_description
  schedule     = var.schedule
  time_zone    = var.time_zone

  attempt_deadline = var.attempt_deadline

  retry_config {
    retry_count         = var.retry_max_attempts
    min_backoff_duration = var.retry_min_backoff_duration
    max_backoff_duration = var.retry_max_backoff_duration
    max_doublings       = 5 # Default, can be made a variable if needed
  }

  pubsub_target {
    topic_name = var.pubsub_topic_name
    data       = base64encode(var.pubsub_message_body)
    attributes = var.pubsub_message_attributes
  }
} 