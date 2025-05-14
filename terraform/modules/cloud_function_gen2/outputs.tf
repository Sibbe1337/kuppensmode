output "function_name" {
  description = "The name of the deployed Cloud Function."
  value       = google_cloudfunctions2_function.function.name
}

output "function_uri" {
  description = "The URI of the deployed HTTP Cloud Function (if applicable)."
  value       = google_cloudfunctions2_function.function.service_config[0].uri
}

output "function_id" {
  description = "The fully qualified ID of the Cloud Function."
  value       = google_cloudfunctions2_function.function.id
}

output "service_account_email" {
  description = "The service account email used by the function."
  value       = google_cloudfunctions2_function.function.service_config[0].service_account_email
} 