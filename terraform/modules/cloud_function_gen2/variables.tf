variable "project_id" {
  description = "The GCP project ID where the Cloud Function will be deployed."
  type        = string
}

variable "region" {
  description = "The GCP region for the Cloud Function."
  type        = string
}

variable "function_name" {
  description = "The base name for the Cloud Function (e.g., api-service, data-processor)."
  type        = string
}

variable "function_description" {
  description = "A description for the Cloud Function."
  type        = string
  default     = "Cloud Function managed by Terraform."
}

variable "runtime" {
  description = "The runtime environment for the Cloud Function (e.g., nodejs20)."
  type        = string
  default     = "nodejs20"
}

variable "entry_point" {
  description = "The name of the exported JavaScript function to be executed."
  type        = string
}

variable "source_archive_bucket" {
  description = "The GCS bucket name containing the zipped source code for the function."
  type        = string
}

variable "source_archive_object" {
  description = "The GCS object name (path within the bucket) for the zipped source code."
  type        = string
}

variable "service_account_email" {
  description = "The email of the IAM service account the function will run as."
  type        = string
}

variable "available_memory" {
  description = "The amount of memory allocated to the function (e.g., \"256Mi\", \"1Gi\")."
  type        = string
  default     = "256Mi"
}

variable "timeout_seconds" {
  description = "The timeout for the function in seconds."
  type        = number
  default     = 60
}

variable "environment_variables" {
  description = "A map of environment variables to set for the function."
  type        = map(string)
  default     = {}
}

variable "secret_environment_variables" {
  description = "A list of objects defining environment variables sourced from Secret Manager."
  type = list(object({
    key        = string # Name of the environment variable
    project_id = string # Project ID of the secret (can be different from function project)
    secret_id  = string # Secret ID in Secret Manager
    version    = string # Secret version (e.g., "latest" or specific version number)
  }))
  default = []
}

variable "trigger_type" {
  description = "Type of trigger for the function. Supported: \"HTTP\", \"PUBSUB\"."
  type        = string
  validation {
    condition     = contains(["HTTP", "PUBSUB"], var.trigger_type)
    error_message = "Allowed values for trigger_type are HTTP or PUBSUB."
  }
}

variable "http_trigger_security_level" {
  description = "Security level for HTTP trigger. E.g., SECURE_ALWAYS (requires auth), SECURE_OPTIONAL, ALLOW_UNAUTHENTICATED."
  type        = string
  default     = "SECURE_ALWAYS"
}

variable "pubsub_trigger_topic_id" {
  description = "The ID (short name) of the Pub/Sub topic to trigger this function. Required if trigger_type is PUBSUB."
  type        = string
  default     = "" # Must be provided if trigger_type is PUBSUB
}

variable "labels" {
  description = "A map of labels to assign to the Cloud Function."
  type        = map(string)
  default     = {}
}

variable "min_instances" {
  description = "Minimum number of instances for the function. Set to 0 for scaling to zero."
  type        = number
  default     = 0 
}

variable "max_instances" {
  description = "Maximum number of instances for the function."
  type        = number
  default     = 100 // Default by GCP if not set, can be adjusted
} 