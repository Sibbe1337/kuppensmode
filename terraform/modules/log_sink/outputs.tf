output "name" {
  description = "The name of the log sink."
  value       = google_logging_project_sink.this.name
} 