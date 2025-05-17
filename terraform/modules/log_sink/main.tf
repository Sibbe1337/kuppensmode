resource "google_logging_project_sink" "this" {
  name        = var.name
  destination = var.destination
  filter      = var.filter
} 