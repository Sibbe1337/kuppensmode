variable "name" {
  description = "The name of the log sink."
  type        = string
}

variable "destination" {
  description = "The destination for the exported logs (e.g., BigQuery dataset URI)."
  type        = string
}

variable "filter" {
  description = "The filter expression for the logs to export."
  type        = string
  default     = ""
} 