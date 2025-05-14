variable "project_id" {
  description = "The ID of the project in which the resource belongs."
  type        = string
}

variable "location_id" {
  description = "The location ID for the Cloud Scheduler job (e.g., region like europe-west1)."
  type        = string
}

variable "job_name" {
  description = "The name of the Cloud Scheduler job."
  type        = string
}

variable "job_description" {
  description = "A human-readable description for the job."
  type        = string
  default     = "Cloud Scheduler job managed by Terraform"
}

variable "schedule" {
  description = "The schedule in Cron format (e.g., '*/10 * * * *')."
  type        = string
}

variable "time_zone" {
  description = "The timezone for the schedule (e.g., 'Etc/UTC')."
  type        = string
  default     = "Etc/UTC"
}

variable "pubsub_topic_name" {
  description = "The full name of the Pub/Sub topic to publish to (e.g., projects/PROJECT_ID/topics/TOPIC_NAME)."
  type        = string
}

variable "pubsub_message_body" {
  description = "The message body to send to the Pub/Sub topic (must be base64 encoded by the module)."
  type        = string
}

variable "pubsub_message_attributes" {
  description = "Attributes for the Pub/Sub message. A map of string to string."
  type        = map(string)
  default     = null
}

variable "attempt_deadline" {
  description = "The deadline for job attempts. If the job attempt has not completed by this deadline, Cloud Scheduler will retry the job."
  type        = string
  default     = "300s" # 5 minutes
}

variable "retry_max_attempts" {
  description = "The maximum number of retry attempts for a failed job."
  type        = number
  default     = 3
}

variable "retry_min_backoff_duration" {
  description = "The minimum amount of time to wait before retrying a job after it fails."
  type        = string
  default     = "5s"
}

variable "retry_max_backoff_duration" {
  description = "The maximum amount of time to wait before retrying a job after it fails."
  type        = string
  default     = "3600s" # 1 hour
}

/* # Removed as it's not a supported argument for google_cloud_scheduler_job
variable "labels" {
  description = "A set of key/value label pairs to assign to the Cloud Scheduler job."
  type        = map(string)
  default     = {}
}
*/ 