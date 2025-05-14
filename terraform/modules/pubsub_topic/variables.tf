variable "project_id" {
  description = "The GCP project ID where the Pub/Sub topic will be created."
  type        = string
}

variable "topic_name" {
  description = "The desired name for the Pub/Sub topic (e.g., my-app-specific-topic-name)."
  type        = string
}

variable "labels" {
  description = "A map of labels to assign to the Pub/Sub topic."
  type        = map(string)
  default     = {}
}

variable "message_storage_policy" {
  description = "Policy constraining how messages published to the topic may be stored. Object with one field: allowed_persistence_regions (list of strings)."
  type = object({
    allowed_persistence_regions = list(string)
  })
  default = null # Defaults to Google-managed storage, can be restricted e.g. to a specific region
} 